# Marketing website

Public Next.js site for downloading Commerce MCP Studio and browsing release history.

Production URL: **[https://ct-mcp.suherman.net/](https://ct-mcp.suherman.net/)** (Cloud Run behind Cloudflare)

## Local development

```bash
npm run dev:website
```

Default local URL: `http://127.0.0.1:3000`

## Deploy

```bash
npm run deploy:website
```

Deploys to Cloud Run service `ct-mcp-website`.

After pushing `website/` changes, git hooks schedule a background deploy to Cloud Run. Track progress with `npm run ci` (same pattern as brightannica-infra). Deploy logs live under `logs/ct-mcp-website/`; state is in `logs/deployments.json`.

```bash
npm run ci -- --once                              # snapshot
npm run deploy:retry -- --repo ct-mcp-website     # retry failed/pending
npm run deploy:stop -- --repo ct-mcp-website      # interrupt running deploy
```

## Configuration

The site reads version history from `https://ct-mcp-registry.suherman.net` and links VSIX downloads from GCS. See `NEXT_PUBLIC_DOWNLOAD_BASE_URL` in `.env.example`.

End users should download from the website rather than building locally. See the [main README](../README.md#install-the-extension) for install steps.

## Related

- [Registry API](registry-api.md) — version history backend
- [Publishing & releases](publishing.md) — VSIX upload to GCS
