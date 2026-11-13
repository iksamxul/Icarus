# Screens

Captures of the rebuilt app from its own end-to-end runs (`npm run test:e2e`, saved in `test-results/`), converted to WebP:

| File | From | Shows |
| --- | --- | --- |
| `live-view.webp` | `pool-during-click.png` | The live view mid-run: Wing on one order, helpers Gust and Plume on the other two. |
| `roster.webp` | `screens-roster.png` | The Project and roster sheet. |
| `connections.webp` | `screens-connections.png`, cropped | The Models and MCP sheet. The bottom line, which shows the local config path (with the Windows user name), is cropped off. |

To refresh: rerun the e2e scenarios, then convert again and crop any line that shows a local path.
