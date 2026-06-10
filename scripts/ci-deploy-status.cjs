#!/usr/bin/env node
/**
 * Track local ct-mcp website deploy progress with live log tail preview.
 *
 * Usage:
 *   npm run ci
 *   npm run ci -- --once
 */

const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { DEPLOY_TARGETS, REPO_ROOT } = require("./deploy-config.cjs");
const { readState, STATE_FILE, findDeployment } = require("./deploy-store.cjs");
const { lastLogLine, tailLogLines, sanitizeTerminal } = require("./deploy-log-utils.cjs");

const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const wrap =
  (open) =>
  (t) =>
    useColor ? `${open}${t}\x1b[0m` : t;
const green = wrap("\x1b[32m");
const red = wrap("\x1b[31m");
const yellow = wrap("\x1b[33m");
const cyan = wrap("\x1b[36m");
const magenta = wrap("\x1b[35m");
const blue = wrap("\x1b[34m");
const dim = wrap("\x1b[2m");
const bold = wrap("\x1b[1m");
const boldGreen = (t) => bold(green(t));
const boldRed = (t) => bold(red(t));
const boldYellow = (t) => bold(yellow(t));
const boldCyan = (t) => bold(cyan(t));

const LOG_TAIL_LINES = Number.parseInt(process.env.CT_MCP_CI_LOG_LINES || "12", 10);

const TABLE = {
  component: 30,
  status: 12,
  head: 9,
  deployed: 9,
  lastRun: 18,
};

function parseArgs(argv) {
  let once = false;
  let intervalMs = Number.parseInt(process.env.CT_MCP_CI_INTERVAL || "2", 10) * 1000;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--once") once = true;
    else if (argv[i] === "--interval" && argv[i + 1]) {
      intervalMs = Math.max(1, Number.parseInt(argv[++i], 10) || 2) * 1000;
    } else if (argv[i] === "-h" || argv[i] === "--help") {
      console.log(`Usage: npm run ci [-- --once] [--interval <sec>]

  npm run ci                         live dashboard (Ctrl+C safe)
  npm run ci -- --once               snapshot
  npm run deploy:stop -- --repo <n>  interrupt deploy
  npm run deploy:retry               retry failed/pending targets

  CT_MCP_CI_LOG_LINES=12             log tail lines (default 12)
`);
      process.exit(0);
    }
  }
  return { once, intervalMs };
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function gitHead() {
  const r = spawnSync("git", ["rev-parse", "HEAD"], { cwd: REPO_ROOT, encoding: "utf8" });
  return r.status === 0 ? r.stdout.trim() : null;
}

function boxWidth() {
  const cols = process.stdout.columns || 80;
  const tableInner =
    TABLE.component +
    TABLE.status +
    TABLE.head +
    TABLE.deployed +
    TABLE.lastRun +
    14;
  return Math.max(tableInner + 4, Math.min(cols - 1, 120));
}

function stripAnsi(text) {
  return String(text).replace(/\x1b\[[0-9;]*m/g, "");
}

function truncatePlain(text, max) {
  const plain = stripAnsi(text);
  if (plain.length <= max) return plain;
  const suffix = "…";
  const cut = Math.max(1, max - suffix.length);
  return `${plain.slice(0, cut)}${suffix}`;
}

function padPlain(text, width) {
  const plain = truncatePlain(text, width);
  return plain + " ".repeat(Math.max(0, width - plain.length));
}

function padCol(text, width, colorFn) {
  const plain = truncatePlain(text, width);
  const pad = " ".repeat(Math.max(0, width - plain.length));
  const colored = colorFn ? colorFn(plain) : plain;
  return colored + pad;
}

function clipBoxLine(line, inner) {
  const safe = sanitizeTerminal(line);
  const plain = stripAnsi(safe);
  const clipped = truncatePlain(plain, inner);
  const pad = " ".repeat(Math.max(0, inner - clipped.length));
  if (plain.length <= inner) return { text: safe, pad };
  const open = safe.match(/^(\x1b\[[0-9;]*m)+/)?.[0] || "";
  const close = safe.includes("\x1b[0m") ? "\x1b[0m" : "";
  return { text: `${open}${clipped}${close}`, pad };
}

function clearScreen() {
  if (process.stdout.isTTY) {
    process.stdout.write("\x1b[2J\x1b[H");
  }
}

function renderBox(title, lines, options = {}) {
  const width = options.width || boxWidth();
  const inner = width - 4;
  const bar = "─".repeat(Math.max(1, width - 2));
  const titlePad = Math.max(0, width - stripAnsi(title).length - 5);
  console.log(`┌─ ${bold(title)} ${"─".repeat(titlePad)}┐`);
  for (const line of lines) {
    const { text, pad } = clipBoxLine(line, inner);
    console.log(`│ ${text}${pad} │`);
  }
  console.log(`└${bar}┘`);
}

function formatRelativeTime(iso) {
  if (!iso) return "—";
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function formatDuration(ms) {
  if (ms == null) return "";
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  return `${min}m ${sec % 60}s`;
}

function statusLabel(status) {
  switch (status) {
    case "in_progress":
      return { text: "⟳ running", color: boldYellow };
    case "queued":
      return { text: "◷ queued", color: boldCyan };
    case "success":
      return { text: "✓ success", color: boldGreen };
    case "failure":
      return { text: "✗ failure", color: boldRed };
    case "cancelled":
      return { text: "⊘ cancelled", color: magenta };
    case "idle":
    default:
      return { text: "– idle", color: dim };
  }
}

function isUpToDate(row) {
  return (
    row.lastOutcome === "success" &&
    row.headSha !== "—" &&
    row.headSha === row.deployedSha
  );
}

function shaColor(headSha, deployedSha, pendingDeploy, active, lastOutcome) {
  if (headSha === "—") return dim;
  if (active) return boldCyan;
  if (lastOutcome === "success") {
    if (headSha === deployedSha && deployedSha !== "—") return boldGreen;
    return green;
  }
  if (headSha === deployedSha && deployedSha !== "—") return boldGreen;
  if (deployedSha === "—") return pendingDeploy ? yellow : dim;
  return yellow;
}

function lastRunColor(row) {
  if (row.status === "in_progress" || row.status === "queued") return boldYellow;
  if (row.lastOutcome === "success") return boldGreen;
  if (row.lastOutcome === "failure") return boldRed;
  if (row.lastOutcome === "cancelled") return magenta;
  return dim;
}

function componentNameColor(row) {
  if (row.status === "in_progress" || row.status === "queued") return boldCyan;
  if (row.lastOutcome === "success") {
    return isUpToDate(row) ? boldGreen : green;
  }
  if (row.pendingDeploy) return yellow;
  if (row.lastOutcome === "failure") return boldRed;
  return (t) => t;
}

function displayStatus(row) {
  if (row.status === "in_progress" || row.status === "queued") {
    return statusLabel(row.status);
  }
  if (row.lastOutcome) {
    return statusLabel(row.lastOutcome);
  }
  return statusLabel("idle");
}

function isPendingDeploy(rs, lastDeploy) {
  if (!rs.headSha || rs.headSha === rs.lastDeployedSha) return false;
  if (!rs.lastDeployedSha) {
    return lastDeploy?.sha === rs.headSha && lastDeploy?.status !== "success";
  }
  return true;
}

function summarize(state) {
  const head = gitHead();
  const rows = [];
  let active = 0;
  let failed = 0;
  let pending = 0;
  let everDeployed = false;

  for (const target of DEPLOY_TARGETS) {
    const rs = state.repos[target.repo] || {};
    if (head) rs.headSha = head;

    const activeStatus =
      rs.status === "in_progress" || rs.status === "queued" ? rs.status : null;
    const lastDeploy = rs.lastDeploymentId
      ? findDeployment(state, rs.lastDeploymentId)
      : null;
    const lastOutcome = lastDeploy?.status || null;
    const rowStatus = activeStatus || "idle";
    const pendingDeploy = isPendingDeploy(rs, lastDeploy);

    if (lastDeploy) everDeployed = true;
    if (activeStatus) active += 1;
    if (!activeStatus && lastOutcome === "failure") failed += 1;
    if (!activeStatus && pendingDeploy) pending += 1;

    const current = rs.currentDeploymentId
      ? findDeployment(state, rs.currentDeploymentId)
      : null;
    const logRef = activeStatus
      ? current?.logFile || lastDeploy?.logFile
      : lastDeploy?.logFile || null;

    rows.push({
      repo: target.repo,
      label: target.label,
      deployable: Boolean(target.npmScript),
      note: target.note,
      status: rowStatus,
      lastOutcome,
      pendingDeploy,
      branch: rs.branch || target.branch || "main",
      headSha: rs.headSha ? rs.headSha.slice(0, 7) : "—",
      deployedSha: rs.lastDeployedSha ? rs.lastDeployedSha.slice(0, 7) : "—",
      lastRun:
        current?.startedAt || lastDeploy?.finishedAt || lastDeploy?.startedAt || null,
      duration: lastDeploy?.durationMs,
      logFile: logRef,
      lastLine: logRef ? lastLogLine(logRef) : null,
      logTail: logRef ? tailLogLines(logRef, LOG_TAIL_LINES) : [],
      logLive: Boolean(activeStatus),
      pid: rs.pid,
      error: rs.lastError,
    });
  }

  return { rows, active, failed, pending, everDeployed };
}

const TABLE_SEP = dim(" │ ");

function tableSep() {
  return dim(
    [
      "─".repeat(TABLE.component),
      "─".repeat(TABLE.status),
      "─".repeat(TABLE.head),
      "─".repeat(TABLE.deployed),
      "─".repeat(TABLE.lastRun),
    ].join("─┼─"),
  );
}

function tableRow(cells) {
  return cells.join(TABLE_SEP);
}

function tableHeader() {
  return tableRow([
    bold(padPlain("Component", TABLE.component)),
    bold(padPlain("Status", TABLE.status)),
    bold(padPlain("HEAD", TABLE.head)),
    bold(padPlain("Deployed", TABLE.deployed)),
    bold(padPlain("Last run", TABLE.lastRun)),
  ]);
}

function buildStatusBoxLines(state, rows, active, failed, pending, everDeployed) {
  const relState = path.relative(process.cwd(), STATE_FILE) || STATE_FILE;
  const lines = [
    dim(`State: ${relState}`),
    dim(`Updated: ${state.updatedAt || "—"}  ·  Ctrl+C exits dashboard only`),
    "",
    tableHeader(),
    tableSep(),
  ];

  for (const row of rows) {
    if (!row.deployable) {
      lines.push(
        tableRow([
          dim(padPlain(truncatePlain(row.label, TABLE.component), TABLE.component)),
          dim(padPlain("— skip", TABLE.status)),
          dim(padPlain("", TABLE.head)),
          dim(padPlain("", TABLE.deployed)),
          dim(padPlain(truncatePlain(row.note || "", TABLE.lastRun), TABLE.lastRun)),
        ]),
      );
      continue;
    }

    const st = displayStatus(row);
    const when = row.lastRun ? formatRelativeTime(row.lastRun) : "—";
    const dur =
      row.status === "in_progress" || row.status === "queued"
        ? ""
        : row.duration != null
          ? ` (${formatDuration(row.duration)})`
          : "";
    const lastRunText = truncatePlain(`${when}${dur}`, TABLE.lastRun);

    const headColor = shaColor(
      row.headSha,
      row.deployedSha,
      row.pendingDeploy,
      row.status === "in_progress" || row.status === "queued",
      row.lastOutcome,
    );
    const deployedColor = shaColor(
      row.deployedSha,
      row.headSha,
      row.pendingDeploy,
      false,
      row.lastOutcome,
    );

    lines.push(
      tableRow([
        padCol(truncatePlain(row.label, TABLE.component), TABLE.component, componentNameColor(row)),
        padCol(st.text, TABLE.status, st.color),
        padCol(row.headSha, TABLE.head, headColor),
        padCol(row.deployedSha, TABLE.deployed, deployedColor),
        padCol(lastRunText, TABLE.lastRun, lastRunColor(row)),
      ]),
    );

    if (row.pid) {
      lines.push(dim(`  pid ${row.pid}`));
    }
    if (row.status === "idle" && isUpToDate(row)) {
      lines.push(green(`  ↳ deployed and up to date`));
    } else if (row.status === "idle" && row.pendingDeploy) {
      const retryHint = `  ↳ new commit ${row.headSha} — npm run deploy:retry -- --repo ${row.repo}`;
      lines.push(row.lastOutcome === "success" ? dim(retryHint) : yellow(retryHint));
    } else if (
      row.status === "idle" &&
      (row.lastOutcome === "failure" || row.lastOutcome === "cancelled")
    ) {
      lines.push(yellow(`  ↳ retry: npm run deploy:retry -- --repo ${row.repo}`));
    }
    if (row.error && row.lastOutcome === "failure") {
      lines.push(red(`  ↳ ${row.error}`));
    }
  }

  lines.push("");
  if (active > 0) {
    lines.push(yellow(`${active} deployment(s) running — refreshing…`));
    lines.push(dim("Interrupt: npm run deploy:stop -- --repo ct-mcp-website"));
  } else if (pending > 0 || failed > 0) {
    if (pending > 0) {
      lines.push(yellow(`${pending} target(s) have undeployed commits`));
    }
    if (failed > 0) {
      lines.push(red(`${failed} target(s) last deploy failed`));
    }
    lines.push(dim("Retry all:  npm run deploy:retry"));
  } else if (!everDeployed) {
    lines.push(yellow("No deployments yet."));
    lines.push(dim("Push website changes or run: npm run deploy:retry -- --repo ct-mcp-website"));
  } else {
    lines.push(green("All deployable targets idle and up to date."));
  }

  return lines;
}

function needsAttention(row) {
  return (
    row.logLive ||
    row.pendingDeploy ||
    row.lastOutcome === "failure" ||
    row.lastOutcome === "cancelled"
  );
}

function printLogSection(title, rows) {
  const logRows = rows
    .filter((row) => {
      if (!row.deployable || !row.logFile) return false;
      if (!needsAttention(row)) return false;
      return row.logLive || row.logTail.length > 0;
    })
    .sort((a, b) => {
      if (a.logLive !== b.logLive) return a.logLive ? -1 : 1;
      const ta = a.lastRun ? new Date(a.lastRun).getTime() : 0;
      const tb = b.lastRun ? new Date(b.lastRun).getTime() : 0;
      return tb - ta;
    });

  if (logRows.length === 0) return;

  const allSuccess = logRows.every(
    (row) => row.lastOutcome === "success" && !row.logLive,
  );
  console.log("");
  console.log(allSuccess ? boldGreen(title) : bold(title));

  for (let i = 0; i < logRows.length; i += 1) {
    const row = logRows[i];
    if (i > 0) console.log("");

    const st = row.logLive ? statusLabel(row.status) : displayStatus(row);
    const mode = row.logLive
      ? boldYellow("live")
      : row.lastOutcome === "success"
        ? green("last deploy")
        : blue("last deploy");
    const dur =
      !row.logLive && row.duration != null
        ? dim(` · ${formatDuration(row.duration)}`)
        : "";
    const when = row.lastRun ? dim(` · ${formatRelativeTime(row.lastRun)}`) : "";

    const labelColor =
      row.lastOutcome === "success" ? boldGreen : row.logLive ? boldCyan : boldCyan;
    const logLineColor = row.lastOutcome === "success" ? green : cyan;
    const logPathColor = row.lastOutcome === "success" ? (t) => dim(green(t)) : dim;

    console.log(`${labelColor(row.label)}  ${mode}  ${st.color(st.text)}${when}${dur}`);
    console.log(logPathColor(`  ${row.logFile}`));

    const tail = row.logTail.length > 0 ? row.logTail : ["(waiting for log output…)"];
    for (const line of tail) {
      console.log(logLineColor(`  ${sanitizeTerminal(line)}`));
    }
  }
}

function printDashboard(state) {
  const { rows, active, failed, pending, everDeployed } = summarize(state);

  clearScreen();
  renderBox(
    "CT MCP local deployments",
    buildStatusBoxLines(state, rows, active, failed, pending, everDeployed),
  );

  const logTitle = active > 0 ? "Deploy logs (live)" : "Last deployment logs";
  printLogSection(logTitle, rows);
}

async function main() {
  const { once, intervalMs } = parseArgs(process.argv.slice(2));

  process.on("SIGINT", () => {
    console.log(dim("\nDashboard closed. Deployments still running — npm run ci"));
    process.exit(0);
  });

  while (true) {
    const state = readState();
    if (process.stdout.isTTY) {
      printDashboard(state);
    } else {
      const { rows, failed, pending } = summarize(state);
      for (const row of rows) {
        if (!row.deployable) continue;
        console.log(
          `${row.repo}\t${row.status}\t${row.lastOutcome || ""}\t${row.lastLine || ""}\t${row.logFile || ""}`,
        );
      }
      if (once) process.exit(failed > 0 || pending > 0 ? 1 : 0);
    }

    const { active, failed, pending } = summarize(state);
    if (once || active === 0) {
      process.exit(failed > 0 || pending > 0 ? 1 : 0);
    }

    await sleep(intervalMs);
  }
}

main().catch((err) => {
  console.error(red(`ci-deploy-status: ${err.message || err}`));
  process.exit(1);
});
