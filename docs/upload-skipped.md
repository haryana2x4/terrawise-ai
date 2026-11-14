# Excluded Paths (Upload Staging)

The following paths were excluded when creating the clean staging copy in accordance with Step 1.2 (paths only; original folders were untouched):

| Source Path | Exclusion Reason |
| :--- | :--- |
| `terrawise:.git/` | excluded directory (.git) |
| `terrawise:.gitignore` | replaced by root staging .gitignore |
| `terrawise:backend/data/cache/open_meteo_19.100_74.740.json` | local live-API response cache |
| `terrawise:backend/data/cache/open_meteo_19.382_74.652.json` | local live-API response cache |
| `terrawise:backend/data/cache/open_meteo_19.383_74.652.json` | local live-API response cache |
| `terrawise:backend/data/cache/open_meteo_20.000_73.790.json` | local live-API response cache |
| `terrawise:backend/data/terrawise.db` | SQLite database file |
| `terrawise:backend/__pycache__/` | excluded directory (__pycache__) |
| `terrawise:data/geo/fields.geojson` | farmer parcel boundaries (regenerated via backend/generate_fields.py) |
| `terrawise:frontend/dist/` | excluded directory (dist) |
| `terrawise:frontend/node_modules/` | excluded directory (node_modules) |
| `terrawise:tests/__pycache__/` | excluded directory (__pycache__) |
| `ai-bot:.agents/` | excluded directory (.agents) |
| `ai-bot:data/memory.json` | local runtime assistant memory |
| `ai-bot:node_modules/` | excluded directory (node_modules) |
| `orien:.Beyond Earth — Orbital Application Portal.qoder.site` | local IDE deployment state file |
| `orien:.git/` | excluded directory (.git) |
| `orien:.gitignore` | covered by root staging .gitignore |
| `orien:.vscode/` | excluded directory (.vscode) |
| `orien:dist/` | excluded directory (dist) |
| `orien:Fall` | untracked scratch text note |
| `orien:gitignore.template` | template superseded by root .gitignore |
| `orien:node_modules/` | excluded directory (node_modules) |
