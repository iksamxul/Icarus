# ICARUS showcase

A static page for ICARUS: no build step, no CDN, no web fonts.

```bash
node showcase/serve.mjs
```

Opens on http://127.0.0.1:3000/ (pass another port as the first argument). The server only serves this folder, only on loopback.

## Files

- `index.html`: the page.
- `assets/styles.css`: Liquid Glass material, dark and light themes, layout.
- `assets/swarm.js`: the hero's cursor swarm. The lead splits the task into eight jobs; the four roster agents take the first four, then four helpers (Gust, Plume, Quill, Ember, in the app's agentColor() colours) join into open slots, the way the app's pool does when everyone is busy. Critically damped springs, a simulation clock that stops when the stage is off screen, the tab is hidden or Pause is pressed, and a still frame for `prefers-reduced-motion`.
- `assets/story.js`: the scroll-driven comic ("A short comic about a lamp", five scenes). Each scene pins while its progress runs 0 to 1 from the scroll position alone. Elements opt in with `data-in="a b"` / `data-out="c d"` (eased `--t` / `--o`), `data-count` (a counter) and `data-way` (a cursor travelling through targets). `--x/--y` place art in landscape panels, `--px/--py` in portrait ones. With reduced motion or no JavaScript, every scene is its last frame.
- `assets/site.js`: theme switch, the nav's glass rule, reveals, the diagram's connectors, copy buttons.
- `assets/mark.svg`: the mark and favicon.
- `shots/`: app screenshots go here (see `shots/README.md`).

## Glass and performance

`backdrop-filter` is on one pane only: the fixed nav capsule. While the running swarm passes under it, the nav slides up out of the way and comes back once the stage has passed, so nothing animated ever sits behind glass. Every other pane is a translucent fill over a static ambient field.

## Credits

Motion inspired by Swarm by Joel Califa and Swarm Rebuild by Dhvanil Patel. The choreography, cursor art and code here are original.
