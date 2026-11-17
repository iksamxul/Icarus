/* ICARUS showcase: the webtoon and the prologue's scroll.

   Panels: each [data-pn] plays its beat once when it is well on screen
   (.in), and its cast idles only while any of it is visible (.vis). That
   is all the script does for the comic: the motion itself is CSS on
   transform and opacity, which the compositor runs off the main thread.

   Prologue: the 3D scene reads how far you have scrolled through its
   pinned stretch (0..1) from a 'prologue:progress' event, and the three
   captions under it swap at a third and two thirds. One rectangle read per
   frame, only while scrolling.

   With prefers-reduced-motion (or no JavaScript) nothing pins or animates:
   every panel is its finished frame and the prologue shows the wings. */
(() => {
  'use strict';

  const story = document.querySelector('[data-story]');
  const pro = document.querySelector('[data-prologue]');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let motion = false;

  /* ── Panels ───────────────────────────────────────────────────────── */

  const panels = [...document.querySelectorAll('[data-pn]')]; // every comic panel on the page
  const seen = 'IntersectionObserver' in window
    ? new IntersectionObserver((entries) => {
      for (const e of entries) {
        e.target.classList.toggle('vis', e.isIntersecting);
        if (e.intersectionRatio >= 0.3) e.target.classList.add('in');
      }
    }, { threshold: [0, 0.3] })
    : null;
  panels.forEach((p) => (seen ? seen.observe(p) : p.classList.add('in', 'vis')));

  /* ── Balloons ─────────────────────────────────────────────────────────
     One continuous outline per balloon, built for its measured size, so
     the tail grows out of the body with no seam and the ink line is even.
     data-tail picks where the tail points: bl, br (down left, down right),
     tl, tr (up). Redrawn whenever a balloon changes size. */

  const SVGNS = 'http://www.w3.org/2000/svg';
  const f = (n) => n.toFixed(1);
  const rad = (deg) => (deg * Math.PI) / 180;
  const ellipse = (cx, cy, rx, ry, a0, a1, n) => {
    const out = [];
    for (let i = 0; i <= n; i += 1) {
      const a = a0 + ((a1 - a0) * i) / n;
      out.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]);
    }
    return out;
  };
  const poly = (pts) => `M${pts.map(([x, y]) => `${f(x)} ${f(y)}`).join('L')}`;

  function drawBalloon(el) {
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    if (!w || !h) return;
    const host = el.closest('.sub, .pn');
    const bw = Math.max(2, (host ? host.clientWidth : 700) * 0.0034);
    const kind = el.classList.contains('shout') ? 'shout' : el.classList.contains('think') ? 'think' : 'speech';
    const cx = w / 2;
    const cy = h / 2;
    const rx = w / 2;
    const ry = h / 2;
    const L = Math.min(Math.max(h * 0.42, 12), 36);
    const TAILS = {
      bl: { tc: 114, tip: [cx - rx * 0.52, h + L] },
      br: { tc: 66, tip: [cx + rx * 0.52, h + L] },
      tl: { tc: 246, tip: [cx - rx * 0.52, -L] },
      tr: { tc: 294, tip: [cx + rx * 0.52, -L] },
    };
    const tail = TAILS[el.dataset.tail];
    const pts = [];
    const puffs = [];
    let d = '';

    if (kind === 'speech') {
      if (!tail) {
        const p = ellipse(cx, cy, rx, ry, 0, Math.PI * 2, 120);
        pts.push(...p);
        d = `${poly(p)}Z`;
      } else {
        // The ellipse with a gap, then a comma-shaped tail out and back.
        const gap = 8;
        const p = ellipse(cx, cy, rx, ry, rad(tail.tc + gap), rad(tail.tc - gap + 360), 120);
        const [tx, ty] = tail.tip;
        const b1 = p[p.length - 1];
        const b2 = p[0];
        const c1 = [b1[0] + (tx - b1[0]) * 0.12, b1[1] + (ty - b1[1]) * 0.78];
        const c2 = [b2[0] + (tx - b2[0]) * 0.6, b2[1] + (ty - b2[1]) * 0.32];
        pts.push(...p, tail.tip);
        d = `${poly(p)}Q${f(c1[0])} ${f(c1[1])} ${f(tx)} ${f(ty)}Q${f(c2[0])} ${f(c2[1])} ${f(b2[0])} ${f(b2[1])}Z`;
      }
    } else if (kind === 'think') {
      // A scalloped cloud: bumps bulging out between points on the ellipse.
      const n = Math.max(9, Math.round((w + h) / 24));
      const p = ellipse(cx, cy, rx * 0.95, ry * 0.92, 0, Math.PI * 2, n);
      d = `M${f(p[0][0])} ${f(p[0][1])}`;
      for (let i = 0; i < n; i += 1) {
        const am = ((i + 0.5) / n) * Math.PI * 2;
        const qx = cx + rx * 1.14 * Math.cos(am);
        const qy = cy + ry * 1.2 * Math.sin(am);
        d += `Q${f(qx)} ${f(qy)} ${f(p[i + 1][0])} ${f(p[i + 1][1])}`;
        pts.push([qx, qy]);
      }
      d += 'Z';
      const dir = el.dataset.tail === 'br' || el.dataset.tail === 'tr' ? 1 : -1;
      puffs.push([cx + dir * rx * 0.5, h + ry * 0.34, ry * 0.2], [cx + dir * rx * 0.66, h + ry * 0.78, ry * 0.12]);
      for (const [x, y, r] of puffs) pts.push([x - r * 1.2, y - r], [x + r * 1.2, y + r]);
    } else {
      // A jagged burst; one long spike toward the speaker.
      let seed = el.textContent.length * 7 + 3;
      const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
      const n = Math.max(18, Math.round((w + h) / 15)) * 2;
      const p = [];
      for (let i = 0; i < n; i += 1) {
        const a = (i / n) * Math.PI * 2;
        let k = i % 2 === 0 ? 1.14 + rnd() * 0.12 : 0.9 + rnd() * 0.04;
        if (tail && i % 2 === 0) {
          const off = Math.abs(((((a * 180) / Math.PI - tail.tc) % 360) + 540) % 360 - 180);
          if (off < 360 / n) k = 1.62;
        }
        p.push([cx + rx * k * Math.cos(a), cy + ry * k * Math.sin(a)]);
      }
      pts.push(...p);
      d = `${poly(p)}Z`;
    }

    const pad = bw * 2;
    const xs = pts.map((q) => q[0]);
    const ys = pts.map((q) => q[1]);
    const x0 = Math.min(0, ...xs) - pad;
    const y0 = Math.min(0, ...ys) - pad;
    const x1 = Math.max(w, ...xs) + pad;
    const y1 = Math.max(h, ...ys) + pad;
    let svg = el.querySelector(':scope > svg.bal-shape');
    if (!svg) {
      svg = document.createElementNS(SVGNS, 'svg');
      svg.setAttribute('class', 'bal-shape');
      svg.setAttribute('aria-hidden', 'true');
      el.prepend(svg);
    }
    svg.setAttribute('viewBox', `${f(x0)} ${f(y0)} ${f(x1 - x0)} ${f(y1 - y0)}`);
    Object.assign(svg.style, { left: `${f(x0)}px`, top: `${f(y0)}px`, width: `${f(x1 - x0)}px`, height: `${f(y1 - y0)}px` });
    svg.innerHTML = `<path d="${d}" stroke-width="${f(bw)}"/><path class="sheen" d="${d}"/><path class="rim" d="${d}" stroke-width="${f(Math.max(1, bw * 0.45))}" transform="translate(0 ${f(bw * 0.9)})"/>${puffs.map(([x, y, r]) => `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(r * 1.2)}" ry="${f(r)}" stroke-width="${f(bw * 0.85)}"/>`).join('')}`;
    el.classList.add('drawn');
  }

  const balloons = [...document.querySelectorAll('.bal')];
  const sized = new WeakMap();
  if ('ResizeObserver' in window) {
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        const key = `${Math.round(e.target.offsetWidth)}x${Math.round(e.target.offsetHeight)}`;
        if (sized.get(e.target) === key) continue;
        sized.set(e.target, key);
        drawBalloon(e.target);
      }
    });
    balloons.forEach((b) => ro.observe(b));
  } else {
    balloons.forEach(drawBalloon);
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => balloons.forEach(drawBalloon));

  /* ── Prologue ─────────────────────────────────────────────────────── */

  const steps = pro ? [...pro.querySelectorAll('[data-step]')] : [];
  const clamp = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  let proP = -1;
  let proStep = -1;
  let queued = false;

  function prologue(force) {
    queued = false;
    if (!pro) return;
    let p = 1;
    if (motion) {
      const r = pro.getBoundingClientRect();
      if (!force && (r.bottom < -200 || r.top > window.innerHeight + 200)) return;
      p = clamp(-r.top / Math.max(1, r.height - window.innerHeight));
    }
    if (p === proP && !force) return;
    proP = p;
    pro.dataset.p = p.toFixed(4);
    window.dispatchEvent(new CustomEvent('prologue:progress', { detail: p }));
    // The opening: the cover's words first, then the swarm's as the wings
    // form. The hint goes as soon as the reader starts to scroll.
    pro.dataset.act = p < 0.24 ? 'cover' : 'swarm';
    pro.toggleAttribute('data-scrolled', p > 0.02);
    const step = p < 0.24 ? 0 : p < 0.6 ? 1 : 2;
    if (step !== proStep) {
      proStep = step;
      steps.forEach((el) => el.classList.toggle('on', Number(el.dataset.step) === step));
    }
  }
  function queue() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => prologue(false));
  }

  function setMode() {
    motion = !reduced.matches;
    if (story) story.toggleAttribute('data-motion', motion);
    document.documentElement.toggleAttribute('data-comic', motion);
    if (pro) pro.toggleAttribute('data-motion', motion);
    if (!motion) panels.forEach((p) => p.classList.add('in'));
    prologue(true);
  }

  window.addEventListener('scroll', queue, { passive: true });
  window.addEventListener('resize', () => prologue(true));
  reduced.addEventListener('change', setMode);
  // The 3D module sizes the prologue once it loads: measure again then.
  if (pro && 'ResizeObserver' in window) new ResizeObserver(() => prologue(true)).observe(pro);
  setMode();
})();
