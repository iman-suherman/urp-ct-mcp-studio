# Development

Build and run the Commerce MCP Studio VS Code extension from source.

## Prerequisites

| Requirement | Notes |
|-------------|-------|
| **Node.js 18+** | Required to build the extension and run Commerce MCP via `npx` |
| **npm** | Used for dependency install and build |

See the [main README](../README.md#prerequisites) for extension runtime requirements (VS Code, commercetools credentials).

## Clone and install

```bash
git clone <repository-url>
cd urp-ct-mcp-studio
npm install
```

## Build

Compile TypeScript from `src/` into `out/` (the extension entry point):

```bash
npm run build
```

### Watch mode

Recompile automatically on file changes:

```bash
npm run watch
```

### Build output

| Path | Purpose |
|------|---------|
| `out/` | Compiled extension JavaScript |
| `media/` | Extension and activity bar icons |
| `ct-mcp-studio.json` | Bundled default auth/API URLs |
| `node_modules/` | Runtime deps (including `@modelcontextprotocol/sdk`) |

## Run from source

1. Open this folder in VS Code.
2. Press **F5** or run **Terminal → Run Task…** and choose **Run Extension**.
3. A new **Extension Development Host** window opens with the extension loaded.
4. Click the **Commerce MCP** icon in the Activity Bar.

The launch configuration is in `.vscode/launch.json`.

## Package a VSIX locally

```bash
npm run package
```

Creates `releases/ct-mcp-studio-<version>.vsix` (version from `package.json`).

Install locally:

```bash
code --install-extension releases/ct-mcp-studio-0.1.0.vsix
```

Or in VS Code: **Extensions** → **⋯** → **Install from VSIX…**

## Install from folder (advanced)

Copy or symlink the built extension into your VS Code extensions directory.

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

Ensure `npm run build` has been run and `out/extension.js` exists before starting VS Code. Reload the window (**Developer: Reload Window**) after installing.

## Repository layout

```
ct-mcp-studio/
├── src/                  # TypeScript source (extension)
├── out/                  # Compiled output (generated)
├── scripts/              # GCP login, generate-env, upload, registry helpers
├── services/
│   └── registry-api/     # Cloud Run API for version history (Firestore)
├── firestore/
│   └── indexes.json      # Composite index for version queries
├── website/              # Next.js marketing site
├── releases/             # VSIX builds and release notes (contents gitignored)
├── media/                # Extension branding
├── ct-mcp-studio.json    # Bundled defaults
├── .env.example          # Environment template (copy via generate-env)
├── .gcloud/              # Project-local ADC (created by npm run login, gitignored)
├── package.json
└── tsconfig.json
```

For publishing and infrastructure, see [Publishing & releases](publishing.md), [Registry API](registry-api.md), and [Marketing website](website.md).
