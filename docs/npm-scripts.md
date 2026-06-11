# npm scripts reference

All scripts defined in the root `package.json`.

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
| `npm run deploy:extension` | Same as `release`, used by the tracked deploy pipeline |
| `npm run deploy:registry` | Deploy Cloud Run registry API and Firestore index |
| `npm run deploy:website` | Deploy Next.js marketing site to Cloud Run |
| `npm run ci` | Live dashboard for local async deploys (website + VSIX extension) |
| `npm run deploy:retry` | Retry failed or pending deployable targets |
| `npm run deploy:stop` | Interrupt a running deploy (`--repo ct-mcp-website` or `ct-mcp-extension`) |
| `npm run dev:registry` | Run registry API locally on port 8080 |
| `npm run dev:website` | Run marketing website locally on port 3000 |

## See also

- [Development](development.md) — `build`, `watch`, `package`
- [Publishing & releases](publishing.md) — `login`, `upload`, `release`, `deploy:extension`, `release-notes`
- [Registry API](registry-api.md) — `deploy:registry`, `dev:registry`
- [Marketing website](website.md) — `deploy:website`, `dev:website`, `ci`, `deploy:retry`, `deploy:stop`
