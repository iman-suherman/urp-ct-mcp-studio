/**
 * Read and validate the extension version embedded in a VSIX package.
 */
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const PACKAGE_JSON_ENTRY = "extension/package.json";

function readVsixPackageVersion(vsixPath) {
  if (!fs.existsSync(vsixPath)) {
    throw new Error(`VSIX not found: ${vsixPath}`);
  }

  const result = spawnSync("unzip", ["-p", vsixPath, PACKAGE_JSON_ENTRY], {
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });

  if (result.status !== 0 || !result.stdout?.trim()) {
    throw new Error(`Could not read ${PACKAGE_JSON_ENTRY} from ${path.basename(vsixPath)}`);
  }

  let pkg;
  try {
    pkg = JSON.parse(result.stdout);
  } catch {
    throw new Error(`Invalid JSON in ${PACKAGE_JSON_ENTRY} (${path.basename(vsixPath)})`);
  }

  const version = String(pkg.version || "").trim();
  if (!version) {
    throw new Error(`Missing version in ${PACKAGE_JSON_ENTRY} (${path.basename(vsixPath)})`);
  }
  return version;
}

function assertVsixPackageVersion(vsixPath, expectedVersion) {
  const embedded = readVsixPackageVersion(vsixPath);
  if (embedded !== expectedVersion) {
    throw new Error(
      `${path.basename(vsixPath)} embeds v${embedded}, expected v${expectedVersion}`
    );
  }
  return embedded;
}

module.exports = {
  PACKAGE_JSON_ENTRY,
  readVsixPackageVersion,
  assertVsixPackageVersion,
};
