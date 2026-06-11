# Publishing & releases

Package the extension, upload VSIX artifacts to Google Cloud Storage, and register versions in Firestore.

## Prerequisites

| Requirement | Notes |
|-------------|-------|
| **Google Cloud SDK** | Required for `npm run login` and `npm run upload` ([install gcloud](https://cloud.google.com/sdk/docs/install)) |
| **GCP project** | Bucket and Firestore for extension distribution |

## Developer workflow

End-to-end steps from build to publishing the VSIX in Google Cloud Storage.

### 1. Build and package

```bash
npm run build
npm run package
```

See [Development](development.md) for build and watch details.

### 2. Environment and GCP login

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

### 3. Upload the extension to GCS

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

## Upload configuration

Settings in `.env` (see `.env.example`):

| Variable | Default | Description |
|----------|---------|-------------|
| `GCS_EXTENSION_BUCKET` | `{GCP_PROJECT_ID}-ct-mcp-studio` | Target bucket name |
| `GCS_LOCATION` | `australia-southeast1` | Region used when creating the bucket |
| `GCS_EXTENSION_PREFIX` | `extensions` | Object prefix inside the bucket |
| `FIRESTORE_PLUGIN_COLLECTION` | `mcp_plugin_versions` | Firestore collection for version history |
| `FIRESTORE_PLUGIN_CATALOG` | `mcp_plugin_catalog` | Firestore collection for plugin metadata |

## Uploaded objects

```
gs://{bucket}/extensions/ct-mcp-studio-{version}.vsix
gs://{bucket}/extensions/latest.vsix
gs://{bucket}/extensions/release-{version}.json
gs://{bucket}/extensions/release-{version}.md
```

Example after upload to project `personal-suherman`:

```
gs://personal-suherman-ct-mcp-studio/extensions/ct-mcp-studio-0.1.0.vsix
gs://personal-suherman-ct-mcp-studio/extensions/latest.vsix
gs://personal-suherman-ct-mcp-studio/extensions/release-0.1.0.json
```

## Release note grouping

Release notes are grouped from conventional commits:

| Commit prefix | Release note section |
|---------------|---------------------|
| `feat:` | Introduced |
| `fix:` | Fixed |
| `perf:`, `refactor:` | Changed |
| `docs:`, `chore:`, `build:`, `ci:` | Updated |
| `!` or `BREAKING CHANGE` | Breaking changes |

## Troubleshooting

**GCP login or upload fails**

- Install the [Google Cloud SDK](https://cloud.google.com/sdk/docs/install) and ensure `gcloud` is on your `PATH`.
- Run `npm run login` before `npm run upload`.
- Confirm `.gcloud/application_default_credentials.json` exists after login.
- Override `GCS_EXTENSION_BUCKET` in `.env` if the default bucket name is unavailable globally.

After upload, deploy the [Registry API](registry-api.md) so the marketing site can serve version history.
