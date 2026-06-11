# Commerce MCP Studio

VS Code extension for configuring, exploring, testing, and using [Commerce MCP](https://docs.commercetools.com/dev-tooling/mcp/commerce-mcp) servers with commercetools projects.

Instead of hand-editing MCP JSON, use the **Commerce MCP** side panel to manage connections, discover tools dynamically, run tools in a playground, and sync configuration into VS Code Chat.

**Download:** pre-built VSIX packages and release history are available at **[ct-mcp.suherman.net](https://ct-mcp.suherman.net/)**.

> **Install the extension**
>
> Download the latest VSIX from **[CT MCP](https://ct-mcp.suherman.net/)** — browse [release history](https://ct-mcp.suherman.net/) and pick a version, or use **Download latest VSIX**.
>
> In VS Code: open **Extensions** → click **⋯** → **Install from VSIX…** → select the downloaded `.vsix` file.
>
> Reload the window (**Developer: Reload Window**) if prompted, then click the **Commerce MCP** icon in the Activity Bar.
>
> Building from source? See [Install the extension](#install-the-extension) or [Development](docs/development.md).

## Table of contents

### Extension

- [Prerequisites](#prerequisites)
- [Install the extension](#install-the-extension)
- [First-time setup](#first-time-setup)
- [Configuration](#configuration)
- [Commands](#commands)
- [Extension source layout](#extension-source-layout)
- [Troubleshooting](#troubleshooting)

### Documentation

- [Documentation index](docs/README.md)
- [Development](docs/development.md) — build, watch, run from source, package VSIX
- [Publishing & releases](docs/publishing.md) — GCP login, upload, semver releases
- [Registry API](docs/registry-api.md) — version history service
- [Marketing website](docs/website.md) — public download site
- [npm scripts reference](docs/npm-scripts.md)

## Prerequisites

| Requirement | Notes |
|-------------|-------|
| **Node.js 18+** | Required to run Commerce MCP via `npx` |
| **VS Code 1.90+** | Extension host (`engines.vscode`) |
| **Network access** | First connect downloads `@commercetools/commerce-mcp` through `npx` |

You also need commercetools API credentials for your project:

- Project Key
- Client ID
- Client Secret
- Auth URL
- API URL

Client secrets are stored in VS Code **Secret Storage** only — never in `settings.json`.

For building from source or publishing releases, see [Development](docs/development.md) and [Publishing & releases](docs/publishing.md).

## Install the extension

### Option 1 — Download from CT MCP (recommended)

The easiest way to install Commerce MCP Studio:

1. Open **[https://ct-mcp.suherman.net/](https://ct-mcp.suherman.net/)**.
2. Click **Download latest VSIX**, or open **Versions** to pick a specific release.
3. In VS Code: **Extensions** → **⋯** → **Install from VSIX…** → select the downloaded file.
4. Reload the window (**Developer: Reload Window**) if prompted.
5. Click the **Commerce MCP** icon in the Activity Bar.

You can also install from the CLI after downloading:

```bash
code --install-extension ~/Downloads/ct-mcp-studio-0.1.0.vsix
```

### Option 2 — Run from source (development)

Best for local development and debugging.

1. Open this folder in VS Code.
2. Run **Terminal → Run Task…** or press **F5** and choose **Run Extension**.
3. A new **Extension Development Host** window opens with the extension loaded.
4. Click the **Commerce MCP** icon in the Activity Bar (left sidebar).

The launch configuration is in `.vscode/launch.json`. See [Development](docs/development.md) for build and watch details.

### Option 3 — Build and install a VSIX locally

Package the extension for installation in any VS Code instance:

```bash
npm install && npm run build && npm run package
```

This creates `releases/ct-mcp-studio-0.1.0.vsix` (version from `package.json`).

Install the package:

```bash
code --install-extension releases/ct-mcp-studio-0.1.0.vsix
```

Or in VS Code: **Extensions** view → **⋯** menu → **Install from VSIX…** → select the `.vsix` file from `releases/`.

Reload the window (**Developer: Reload Window**) after installing.

Prefer a pre-built release? Use [CT MCP](https://ct-mcp.suherman.net/) instead of building yourself.

### Option 4 — Install from folder (advanced)

See [Development — Install from folder](docs/development.md#install-from-folder-advanced).

## First-time setup

1. Open the **Commerce MCP** side panel.
2. Go to the **Connections** tab.
3. Enter connection details and click **Save Connection**.
4. Click **Connect**.

On connect, the extension:

- Spawns `@commercetools/commerce-mcp` over stdio
- Calls `tools/list` to discover available tools
- Optionally syncs `mcp.servers.commerce-mcp` for VS Code Chat (when `ctMcp.syncNativeMcpConfig` is enabled)

5. Click **Open Explorer** to run tools with JSON arguments.

## Configuration

Settings are under **Commerce MCP Studio** (`ctMcp.*`):

| Setting | Default | Description |
|---------|---------|-------------|
| `ctMcp.autoConnectOnStartup` | `true` | Reconnect to the last active connection on startup |
| `ctMcp.syncNativeMcpConfig` | `true` | Write native `mcp.servers` config for Chat |
| `ctMcp.dynamicToolLoadingThreshold` | `450` | Tool injection limit when using `--tools=all` |
| `ctMcp.commerceMcpPackage` | `@commercetools/commerce-mcp@latest` | npm package spawned by the extension |

Default Auth/API URLs for new connections come from `ct-mcp-studio.json` at the extension root.

## Commands

Open the Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`) and search for **Commerce MCP**:

| Command | Description |
|---------|-------------|
| **Open Commerce MCP Studio** | Focus the side panel |
| **Open MCP Explorer** | Open the tool playground |
| **Connect Commerce MCP** | Connect the active connection |
| **Disconnect Commerce MCP** | Stop the MCP process |
| **Refresh Commerce MCP** | Reload the tool list |

## Extension source layout

The VS Code extension lives under `src/` and compiles to `out/`:

```
src/
├── extension.ts           # Activation, commands, view registration
├── studioViewProvider.ts  # Commerce MCP side panel webview
├── studioUi.ts            # Side panel UI templates
├── explorerPanel.ts       # MCP Explorer playground panel
├── explorerUi.ts          # Explorer UI templates
├── mcpManager.ts          # Connection lifecycle and tool calls
├── mcpProcessManager.ts   # Spawn and manage commerce-mcp process
├── mcpBootstrap.ts        # MCP client bootstrap over stdio
├── nativeMcpBridge.ts     # Sync mcp.servers config for VS Code Chat
├── connectionStore.ts     # Saved connection profiles
├── secrets.ts             # VS Code Secret Storage for client secrets
├── config.ts              # ctMcp.* settings and defaults
├── toolCatalog.ts         # Tool discovery and catalog
├── templates.ts           # Shared HTML/CSS/JS for webviews
├── responseFormat.ts      # Format MCP tool responses for display
├── logStore.ts            # In-panel log buffer
├── media.ts               # Webview asset URIs
└── types.ts               # Shared TypeScript types

out/                       # Compiled JavaScript (generated by npm run build)
media/                     # Extension icon and branding assets
ct-mcp-studio.json         # Bundled default auth/API URLs
```

For the full repository layout (scripts, services, website), see [Development — Repository layout](docs/development.md#repository-layout).

## Troubleshooting

**Connect fails immediately**

- Verify Client ID, Client Secret, Project Key, Auth URL, and API URL.
- Ensure Node.js and `npx` are on your `PATH` (VS Code inherits the shell environment).
- Check the **Logs** tab in the side panel.

**Tools do not appear**

- Confirm the API client has scopes for the tools you expect.
- Try **Refresh** after connect.
- Lower or raise `ctMcp.dynamicToolLoadingThreshold` if using `--tools=all`.

**Chat does not see Commerce MCP**

- Ensure `ctMcp.syncNativeMcpConfig` is enabled.
- Reload MCP in VS Code if available (`mcp.reload` / **MCP: Reload**).
- Check `~/Library/Application Support/Code/User/mcp.json` (macOS) for a `commerce-mcp` entry.

**Extension does not load after install**

- Run `npm run build` and confirm `out/extension.js` exists.
- Reload VS Code (**Developer: Reload Window**).

**GCP login or upload fails**

See [Publishing & releases — Troubleshooting](docs/publishing.md#troubleshooting).

## Related documentation

- [Commerce MCP — commercetools Dev Tooling](https://docs.commercetools.com/dev-tooling/mcp/commerce-mcp)
- [commerce-mcp on GitHub](https://github.com/commercetools/commerce-mcp)
- [Documentation index](docs/README.md)

## License

This project is licensed under the [MIT License](LICENSE).
