# Registry API

Cloud Run service that serves historical Commerce MCP Studio plugin versions stored in Firestore.

## Deploy

Deploy once per GCP project:

```bash
npm run deploy:registry
```

This deploys `services/registry-api` to Cloud Run as `ct-mcp-registry-api` (override with `REGISTRY_API_SERVICE` in `.env`) and ensures the Firestore composite index exists.

Requires [GCP login](publishing.md#2-environment-and-gcp-login) and a successful [VSIX upload](publishing.md#3-upload-the-extension-to-gcs) so Firestore has version documents to serve.

## Local development

```bash
npm run dev:registry
```

Default local URL: `http://127.0.0.1:8080`

## Endpoints

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

## Firestore version documents

Each version document includes semver metadata, GCS download paths, structured release notes (`introduced`, `changed`, `updated`, `fixed`, `removed`, `breaking`), markdown release notes, git commit/tag, and publish timestamp.

The [marketing website](website.md) reads version history from the production registry URL and links VSIX downloads from GCS.
