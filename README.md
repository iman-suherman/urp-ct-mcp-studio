# Commerce MCP Studio

VS Code extension for configuring, exploring, testing, and using [Commerce MCP](https://docs.commercetools.com/dev-tooling/mcp/commerce-mcp) servers with commercetools projects.

Instead of hand-editing MCP JSON, use the **Commerce MCP** side panel to manage connections, discover tools dynamically, run tools in a playground, and sync configuration into VS Code Chat.

## Prerequisites

| Requirement | Notes |
|-------------|-------|
| **Node.js 18+** | Required to build the extension and run Commerce MCP via `npx` |
| **npm** | Used for dependency install and build |
| **VS Code 1.90+** | Extension host (`engines.vscode`) |
| **Network access** | First connect downloads `@commercetools/commerce-mcp` through `npx` |

You also need commercetools API credentials for your project:

- Project Key
- Client ID
- Client Secret
- Auth URL
- API URL

Client secrets are stored in VS Code **Secret Storage** only — never in `settings.json`.

## Build from source

Clone the repository and install dependencies:

```bash
git clone <repository-url>
cd urp-ct-mcp-studio
npm install
npm run build
```

This compiles TypeScript from `src/` into `out/`, which is the extension entry point (`main` in `package.json`).

### Watch mode (development)

Recompile automatically on file changes:

```bash
npm run watch
```

### Build output

| Path | Purpose |
|------|---------|
| `out/` | Compiled extension JavaScript |
| `media/logo.png` | Extension and activity bar icon |
| `ct-mcp-studio.json` | Bundled default auth/API URLs |
| `node_modules/` | Runtime deps (including `@modelcontextprotocol/sdk`) |

## Install the extension

### Option 1 — Run from source (development)

Best for local development and debugging.

1. Open this folder in VS Code.
2. Run **Terminal → Run Task…** or press **F5** and choose **Run Extension**.
3. A new **Extension Development Host** window opens with the extension loaded.
4. Click the **Commerce MCP** icon in the Activity Bar (left sidebar).

The launch configuration is in `.vscode/launch.json`.

### Option 2 — Install from a VSIX package

Package the extension for installation in any VS Code instance:

```bash
npm install
npm run build
npx @vscode/vsce package
```

This creates `ct-mcp-studio-0.1.0.vsix` (version from `package.json`).

Install the package:

```bash
code --install-extension ct-mcp-studio-0.1.0.vsix
```

Or in VS Code: **Extensions** view → **⋯** menu → **Install from VSIX…** → select the `.vsix` file.

### Option 3 — Install from folder (advanced)

Copy or symlink the built extension into your VS Code extensions directory:

**macOS**

```bash
ln -s "$(pwd)" "$HOME/.vscode/extensions/qantas.ct-mcp-studio-0.1.0"
```

**Linux**

```bash
ln -s "$(pwd)" "$HOME/.vscode/extensions/qantas.ct-mcp-studio-0.1.0"
```

**Windows (PowerShell)**

```powershell
New-Item -ItemType SymbolicLink `
  -Path "$env:USERPROFILE\.vscode\extensions\qantas.ct-mcp-studio-0.1.0" `
  -Target (Get-Location)
```

Ensure `npm run build` has been run and `out/extension.js` exists before starting VS Code.

Reload the window (**Developer: Reload Window**) after installing.

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

## Project structure

```
ct-mcp-studio/
├── src/                  # TypeScript source
├── out/                  # Compiled output (generated)
├── media/logo.png        # Extension branding
├── ct-mcp-studio.json    # Bundled defaults
├── package.json
└── tsconfig.json
```

## Related documentation

- [Commerce MCP — commercetools Dev Tooling](https://docs.commercetools.com/dev-tooling/mcp/commerce-mcp)
- [commerce-mcp on GitHub](https://github.com/commercetools/commerce-mcp)
