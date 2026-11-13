# Screens

Captures of the real app (Electron), driven through its own end-to-end scenarios, one set per theme. The site shows the dark set in its dark edition and the light set in its light edition.

| File | Shows |
| --- | --- |
| `live-view-{dark,light}.webp` | The live view mid-run: Wing on one order, helpers Gust and Plume on the other two. |
| `roster-{dark,light}.webp` | The Project and roster sheet. |
| `connections-{dark,light}.webp` | The Models and MCP sheet, cropped above the bottom line, which shows the local config path (with the Windows user name). |

To refresh: run the pool scenario and the two sheets in each app theme (in the dark set, every tab's demo page gets its own dark theme), save the window with `capturePage` at 1520 × 940, convert to WebP, and crop any line that shows a local path.
