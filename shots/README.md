# Screens

Captures of the packaged ICARUS 1.0.0, one set per theme. The site shows the dark set in its dark edition and the light set in its light edition. Each image comes at the full 2x capture (3038 px wide) and at half size (`-1x`), and the page picks one through `srcset`.

| File | Shows |
| --- | --- |
| `live-view-{dark,light}.webp` | The live view mid-run: Wing on one order, helpers Gust and Plume on the other two, each mid-click on its shipping option in its own tab, with the cast rail and its tool tiles. 3038 × 1880. |
| `roster-{dark,light}.webp` | The Project and roster sheet. 3038 × 1880. |
| `connections-{dark,light}.webp` | The Models and MCP sheet: the lead on the Test provider, LM Studio off (not running during the capture), Claude as an account connection. Cropped just above the footer, which shows the local config path (with the Windows user name). 3038 × 1734; the page anchors it to the right (`shot-r`). |
| `history-{dark,light}.webp` | Run details after a verified run: summary, exports, the run in numbers and who worked when. 3038 × 1880. |
| `settings-{dark,light}.webp` | The Settings sheet. 3038 × 1880. |
| `verified-{dark,light}.webp` | The stage after a run, all three orders confirmed. 3038 × 1880. |

To refresh: capture the packaged app (originals in `test-results/site-shots-v1/png/`) at 1520 × 940 with `--force-device-scale-factor=2`, the Night set with the demo pages in their dark theme. Convert to WebP, save a half-size copy as `-1x`, and crop any line that shows a local path.
