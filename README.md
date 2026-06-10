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
> Building from source? See [Install the extension](#install-the-extension) below.

## Prerequisites

| Requirement | Notes |
|-------------|-------|
| **Node.js 18+** | Required to build the extension and run Commerce MCP via `npx` |
| **npm** | Used for dependency install and build |
| **VS Code 1.90+** | Extension host (`engines.vscode`) |
| **Network access** | First connect downloads `@commercetools/commerce-mcp` through `npx` |
| **Google Cloud SDK** | Required for `npm run login` and `npm run upload` ([install gcloud](https://cloud.google.com/sdk/docs/install)) |

You also need commercetools API credentials for your project:

- Project Key
- Client ID
- Client Secret
- Auth URL
- API URL

Client secrets are stored in VS Code **Secret Storage** only — never in `settings.json`.

## Developer workflow

End-to-end steps from clone to publishing the VSIX in Google Cloud Storage.

### 1. Install dependencies

```bash
git clone <repository-url>
cd urp-ct-mcp-studio
npm install
```

### 2. Build (compile TypeScript)

```bash
npm run build
```

This compiles `src/` into `out/` (the extension entry point). For active development, use watch mode:

```bash
npm run watch
```

### 3. Package the VSIX

```bash
npm run package
```

Creates `releases/ct-mcp-studio-<version>.vsix` (version from `package.json`).

Install locally:

```bash
code --install-extension releases/ct-mcp-studio-0.1.0.vsix
```

Or in VS Code: **Extensions** → **⋯** → **Install from VSIX…**

### 4. Environment and GCP login

Copy environment defaults, then authenticate with Google Cloud. Credentials are stored in `.gcloud/` (gitignored) and settings in `.env` (gitignored).

```bash
npm run generate-env
```

Edit `.env` if you want defaults prefilled before login (optional):

```bash
GCP_USER_EMAIL=you@example.com
GCP_PROJECT_ID=your-gcp-project
```

Run login:

```bash
npm run login
```

The script will:

1. Prompt for **GCP user email** (prefilled from `.env` when set — press Enter to accept)
2. Open the browser for **Application Default Credentials** sign-in
3. Prompt for **GCP project** (prefilled from `.env` — press Enter to accept, pick a number from the list, or type a project ID)
4. Sync ADC to `.gcloud/application_default_credentials.json`
5. Run `generate-env` and update `.env` with `GCP_PROJECT_ID` and `GCP_USER_EMAIL`

### 5. Upload the extension to GCS

After login, upload the packaged VSIX to Cloud Storage. The bucket is created automatically if it does not exist.

Versions must follow [semantic versioning](https://semver.org/) (`MAJOR.MINOR.PATCH` in `package.json`). On upload the script will:

1. Validate the semver in `package.json`
2. Generate release notes from git history since the previous `v*` tag
3. Upload the VSIX, `latest.vsix`, and release-note artifacts to GCS
4. Register the version in **Firestore** for historical lookup via the registry API

```bash
npm run upload
```

Preview release notes locally without uploading:

```bash
npm run release-notes
```

Or build, package, and upload in one step (skips automatically when there are no new commits since the last Firestore release):

```bash
npm run release
```

`npm run release` compares `HEAD` with `lastReleasedCommit` in Firestore. If nothing changed, it skips build/upload. Otherwise it auto-bumps semver (`patch` / `minor` / `major` from conventional commits), updates `package.json`, generates release notes since the last release commit, then uploads and registers.

Upload settings in `.env` (see `.env.example`):

| Variable | Default | Description |
|----------|---------|-------------|
| `GCS_EXTENSION_BUCKET` | `{GCP_PROJECT_ID}-ct-mcp-studio` | Target bucket name |
| `GCS_LOCATION` | `australia-southeast1` | Region used when creating the bucket |
| `GCS_EXTENSION_PREFIX` | `extensions` | Object prefix inside the bucket |
| `FIRESTORE_PLUGIN_COLLECTION` | `mcp_plugin_versions` | Firestore collection for version history |
| `FIRESTORE_PLUGIN_CATALOG` | `mcp_plugin_catalog` | Firestore collection for plugin metadata |

Uploaded objects:

```
gs://{bucket}/extensions/ct-mcp-studio-{version}.vsix
gs://{bucket}/extensions/latest.vsix
gs://{bucket}/extensions/release-{version}.json
gs://{bucket}/extensions/release-{version}.md
```

Release notes are grouped from conventional commits:

| Commit prefix | Release note section |
|---------------|---------------------|
| `feat:` | Introduced |
| `fix:` | Fixed |
| `perf:`, `refactor:` | Changed |
| `docs:`, `chore:`, `build:`, `ci:` | Updated |
| `!` or `BREAKING CHANGE` | Breaking changes |

Example after upload to project `personal-suherman`:

```
gs://personal-suherman-ct-mcp-studio/extensions/ct-mcp-studio-0.1.0.vsix
gs://personal-suherman-ct-mcp-studio/extensions/latest.vsix
gs://personal-suherman-ct-mcp-studio/extensions/release-0.1.0.json
```

### 6. Deploy the version registry API (Cloud Run + Firestore)

The registry API serves historical plugin versions stored in Firestore. Deploy once per GCP project:

```bash
npm run deploy:registry
```

This deploys `services/registry-api` to Cloud Run as `ct-mcp-registry-api` (override with `REGISTRY_API_SERVICE` in `.env`) and ensures the Firestore composite index exists.

Run locally during development:

```bash
npm run dev:registry
```

Default local URL: `http://127.0.0.1:8080`

### 7. Marketing website (Next.js)

The public site lives in `website/` and is deployed to Cloud Run:

```bash
npm run dev:website      # local http://127.0.0.1:3000
npm run deploy:website   # Cloud Run service ct-mcp-website
npm run ci               # monitor async deploy pipeline (live dashboard)
```

After pushing `website/` changes, git hooks schedule a background deploy to Cloud Run. Track progress with `npm run ci` (same pattern as brightannica-infra). Deploy logs live under `logs/ct-mcp-website/`; state is in `logs/deployments.json`.

```bash
npm run ci -- --once                              # snapshot
npm run deploy:retry -- --repo ct-mcp-website     # retry failed/pending
npm run deploy:stop -- --repo ct-mcp-website      # interrupt running deploy
```

Production URL: **[https://ct-mcp.suherman.net/](https://ct-mcp.suherman.net/)** (Cloud Run behind Cloudflare)

The site reads version history from `https://ct-mcp-registry.suherman.net` and links VSIX downloads from GCS (`NEXT_PUBLIC_DOWNLOAD_BASE_URL` in `.env.example`). End users should download from the website rather than building locally.

#### Registry API endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check |
| `GET` | `/api/v1/plugins` | List registered plugins |
| `GET` | `/api/v1/plugins/{pluginId}/versions` | All versions (newest first) |
| `GET` | `/api/v1/plugins/{pluginId}/versions/latest` | Latest version with release notes |
| `GET` | `/api/v1/plugins/{pluginId}/versions/{version}` | Specific semver release |

Example:

```bash
curl https://ct-mcp-registry-api-….run.app/api/v1/plugins/ct-mcp-studio/versions
curl https://ct-mcp-registry-api-….run.app/api/v1/plugins/ct-mcp-studio/versions/0.1.0
```

Each Firestore version document includes semver metadata, GCS download paths, structured release notes (`introduced`, `changed`, `updated`, `fixed`, `removed`, `breaking`), markdown release notes, git commit/tag, and publish timestamp.

### Root npm scripts

| Script | Description |
|--------|-------------|
| `npm run build` | Compile TypeScript (`src/` → `out/`) |
| `npm run watch` | Recompile on file changes |
| `npm run package` | Create `releases/*.vsix` with `@vscode/vsce` |
| `npm run generate-env` | Copy `.env.example` → `.env` (use `-- --force` to overwrite) |
| `npm run login` | GCP ADC login, project selection, sync `.gcloud/`, update `.env` |
| `npm run release-notes` | Generate semver release notes from git commits |
| `npm run upload` | Package if needed, upload VSIX + release notes, register in Firestore |
| `npm run release` | Smart release: skip if unchanged, else bump semver, build, package, upload, register |
| `npm run deploy:registry` | Deploy Cloud Run registry API and Firestore index |
| `npm run deploy:website` | Deploy Next.js marketing site to Cloud Run |
| `npm run ci` | Live dashboard for local async website deploys |
| `npm run deploy:retry` | Retry failed or pending website deploy |
| `npm run deploy:stop` | Interrupt a running website deploy |
| `npm run dev:registry` | Run registry API locally on port 8080 |
| `npm run dev:website` | Run marketing website locally on port 3000 |

## Build from source

```bash
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

The launch configuration is in `.vscode/launch.json`.

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

**GCP login or upload fails**

- Install the [Google Cloud SDK](https://cloud.google.com/sdk/docs/install) and ensure `gcloud` is on your `PATH`.
- Run `npm run login` before `npm run upload`.
- Confirm `.gcloud/application_default_credentials.json` exists after login.
- Override `GCS_EXTENSION_BUCKET` in `.env` if the default bucket name is unavailable globally.

## Project structure

```
ct-mcp-studio/
├── src/                  # TypeScript source
├── out/                  # Compiled output (generated)
├── scripts/              # GCP login, generate-env, upload, registry helpers
├── services/
│   └── registry-api/     # Cloud Run API for version history (Firestore)
├── firestore/
│   └── indexes.json      # Composite index for version queries
├── releases/             # VSIX builds and release notes (contents gitignored; .gitkeep tracked)
├── media/logo.png        # Extension branding
├── ct-mcp-studio.json    # Bundled defaults
├── .env.example          # Environment template (copy via generate-env)
├── .gcloud/              # Project-local ADC (created by npm run login, gitignored)
├── package.json
└── tsconfig.json
```

## Related documentation

- [Commerce MCP — commercetools Dev Tooling](https://docs.commercetools.com/dev-tooling/mcp/commerce-mcp)
- [commerce-mcp on GitHub](https://github.com/commercetools/commerce-mcp)

## License

This project is licensed under the [MIT License](LICENSE).
