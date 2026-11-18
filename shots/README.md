# Screens

Captures of the real app (Electron), driven through its own end-to-end scenarios. A pair (`-dark`, `-light`) follows the site's edition: the dark one shows in dark, the light one in light. A single capture shows in both. Each image comes at full size and at half size (`-1x`), and the page picks one through `srcset`.

| File | Shows |
| --- | --- |
| `run-{dark,light}.webp` | v1, mid-run: Wing, Wax and Sun on one order each, the cast rail with its tool tiles. The Night one is paused. 2280 × 1410. |
| `plan-review.webp` | v1, the Review the plan sheet before a run starts. Night only. 2280 × 1410. |
| `replay.webp` | v1, Run details with the replay scrubber. Night only, cropped to 1924 × 1190 to leave out two notices that show a local path (with the Windows user name). |
| `rail-folded-{dark,light}.webp` | v1, the cast rail folded to portraits after a run with all three orders verified. 2280 × 1410. |
| `connections-{dark,light}.webp` | The Models and MCP sheet, cropped above the bottom line, which shows the local config path (with the Windows user name). From the earlier Cast & Stage build, kept because the final v1 capture shows LM Studio unreachable during the test run. 3038 × 1786. |

To refresh: the v1 captures come from `test-results/batch2/` and `test-results/audit-run-1520.png` (the window at 1520 × 940, device scale 1.5). Convert to WebP (quality 84), save a half-size copy as `-1x`, and crop any line or notice that shows a local path.
