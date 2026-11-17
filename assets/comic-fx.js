/* ICARUS showcase: comic effects.

   1. Sound effects you make: a click on a link or a button throws a comic
      burst with a word at the pointer (YOINK! for downloads, SNAP! for a
      copy, ZOOM! for a jump down the page, FLIP! for the theme...).
   2. The opening's sound effects: as the swarm flies in, as the wings lock
      (with one soft flash) and as Icarus climbs.
   3. Section titles slam in word by word the first time they arrive.
   4. Panels are inked as you read: the border draws itself around the
      frame, then the real border takes over.
   5. Motion-comic depth: in the story and the yonkoma, each panel's
      backdrop drifts against its cast while you scroll.
   6. Blocks print in as halftone dots; speed lines streak in at the edges
      when the page flies by (a fast scroll, or a jump down the page).

   Everything is transform and opacity on a few elements at a time. Nothing
   here blocks a click or a scroll, and all of it stays off with
   prefers-reduced-motion (story.js sets [data-comic] only when motion is
   welcome). */
(() => {
  'use strict';

  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const still = () => reduced.matches || !root.hasAttribute('data-comic');

  /* ── 1. Sound effects you make ───────────────────────────────────── */

  const layer = document.createElement('div');
  layer.className = 'fx-layer';
  layer.setAttribute('aria-hidden', 'true');
  document.body.append(layer);

  const POOL = ['POW!', 'BAM!', 'KLIK!', 'ZAP!', 'WHAM!', 'BOOP!'];
  const TINTS = ['var(--gold)', 'var(--rose)', 'var(--sky)', '#45ed53', 'var(--iris)', 'var(--sun)'];

  // A jagged starburst, uneven like a hand-inked one.
  function starPath(spikes) {
    const pts = [];
    for (let i = 0; i < spikes * 2; i += 1) {
      const a = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2;
      const r = i % 2 ? 27 + (i % 4 === 1 ? 3 : 0) : 56 - (i % 6 === 0 ? 9 : i % 6 === 2 ? 3 : 0);
      pts.push(`${(Math.cos(a) * r).toFixed(1)},${(Math.sin(a) * r).toFixed(1)}`);
    }
    return `M${pts.join('L')}Z`;
  }
  const STAR = starPath(13);

  function wordFor(el) {
    if (el.matches('[data-theme-set]')) return 'FLIP!';
    if (el.matches('.copy')) return 'SNAP!';
    if (el.matches('[data-to-top]')) return 'WHOOSH!';
    // Read before the stage's own handler runs (capture phase): Pause halts, Play goes.
    if (el.matches('[data-swarm-toggle]')) return /pause/i.test(el.getAttribute('aria-label') || '') ? 'HALT!' : 'GO!';
    const href = el.getAttribute('href') || '';
    if (/releases|download/i.test(href)) return 'YOINK!';
    if (href.startsWith('#')) return 'ZOOM!';
    if (/^https?:/i.test(href)) return 'ZIP!';
    return POOL[Math.floor(Math.random() * POOL.length)];
  }

  let tint = 0;
  function burst(x, y, word) {
    while (layer.childElementCount >= 3) layer.firstElementChild.remove();
    const b = document.createElement('div');
    b.className = 'fx-burst';
    b.style.left = `${Math.round(x)}px`;
    b.style.top = `${Math.round(y)}px`;
    b.style.setProperty('--r', `${(Math.random() * 26 - 13).toFixed(1)}deg`);
    b.style.setProperty('--c', TINTS[tint++ % TINTS.length]);
    b.innerHTML = `<svg class="fx-star" viewBox="-60 -60 120 120"><path d="${STAR}"/></svg><span class="fx-word">${word}</span>`;
    b.addEventListener('animationend', (e) => { if (e.target === b) b.remove(); });
    layer.append(b);
  }

  document.addEventListener('click', (e) => {
    if (still()) return;
    const el = e.target.closest('a, button, [role="button"]');
    if (!el) return;
    let x = e.clientX;
    let y = e.clientY;
    // Keyboard presses have no pointer: burst from the middle of the control.
    if (!e.detail || (!x && !y)) {
      const r = el.getBoundingClientRect();
      x = r.left + r.width / 2;
      y = r.top + r.height / 2;
    }
    burst(x, y, wordFor(el));
  }, { capture: true, passive: true }); // capture: a control that stops propagation still gets its sound

  /* ── 2. The opening's sound effects ─────────────────────────────── */

  const pro = document.querySelector('[data-prologue]');
  const pin = pro && pro.querySelector('.pro-pin');
  if (pin) {
    pin.insertAdjacentHTML('beforeend', `<div class="op-fx" aria-hidden="true">
      <div class="op-flash"></div>
      <p class="op-sfx" data-at="swarm">ヒュン!<small>vwoosh!</small></p>
      <p class="op-sfx" data-at="lock">ガシッ!<small>fwoomp!</small></p>
      <p class="op-sfx" data-at="climb">ゴォォ<small>whoosh!</small></p>
    </div>`);
    const sfx = [...pin.querySelectorAll('.op-sfx')];
    const flash = pin.querySelector('.op-flash');
    const bands = { swarm: [0.24, 0.5], lock: [0.62, 0.8], climb: [0.84, 1.01] };
    let locked = false;
    let lastFlash = 0;
    window.addEventListener('prologue:progress', (ev) => {
      const p = ev.detail;
      if (still() || !pro.hasAttribute('data-motion')) {
        sfx.forEach((s) => s.classList.remove('on'));
        return;
      }
      sfx.forEach((s) => {
        const [a, b] = bands[s.dataset.at];
        s.classList.toggle('on', p >= a && p < b);
      });
      // One soft flash as the wings lock, not every time the reader jiggles.
      const now = p >= 0.62 && p < 0.8;
      if (now && !locked && performance.now() - lastFlash > 1500) {
        lastFlash = performance.now();
        flash.classList.remove('go');
        void flash.offsetWidth;
        flash.classList.add('go');
      }
      locked = now;
    });
  }

  if (still()) return; // the rest only matters when the comic moves

  /* ── 3. Titles that slam in ──────────────────────────────────────── */

  const heads = [...document.querySelectorAll('.sec-h h2')].filter((h) => !h.children.length);
  const slam = 'IntersectionObserver' in window
    ? new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.classList.add('in');
        slam.unobserve(e.target);
      }
    }, { threshold: 0.6 })
    : null;
  heads.forEach((h) => {
    // Split on plain spaces only, so no-break spaces keep their words together.
    const parts = h.textContent.split(/( +|\n+)/);
    h.textContent = '';
    let i = 0;
    for (const part of parts) {
      if (!part) continue;
      if (/^( +|\n+)$/.test(part)) { h.append(' '); continue; }
      const w = document.createElement('span');
      w.className = 'w';
      w.style.setProperty('--i', i++);
      w.textContent = part;
      h.append(w);
    }
    h.classList.add('slam');
    if (slam) slam.observe(h);
    else h.classList.add('in');
  });

  /* ── 4. Panels inked as you read ─────────────────────────────────── */

  const SVG = 'http://www.w3.org/2000/svg';
  const sizeInk = (pn) => {
    const svg = pn.inkSvg;
    if (!svg) return;
    const w = pn.clientWidth;
    const h = pn.clientHeight;
    const r = parseFloat(getComputedStyle(pn).borderTopLeftRadius) || 0;
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    const rect = svg.firstElementChild;
    rect.setAttribute('width', w);
    rect.setAttribute('height', h);
    rect.setAttribute('rx', Math.max(0, r - 3));
  };
  const inkRO = 'ResizeObserver' in window ? new ResizeObserver((entries) => entries.forEach((e) => sizeInk(e.target))) : null;
  document.querySelectorAll('.pn').forEach((pn) => {
    if (pn.classList.contains('in') || !inkRO) return; // already on screen: keep its border
    const svg = document.createElementNS(SVG, 'svg');
    svg.setAttribute('class', 'ink-draw');
    svg.setAttribute('aria-hidden', 'true');
    const rect = document.createElementNS(SVG, 'rect');
    rect.setAttribute('pathLength', '1');
    svg.append(rect);
    pn.append(svg);
    pn.inkSvg = svg;
    pn.classList.add('inking');
    inkRO.observe(pn);
    rect.addEventListener('animationend', () => {
      pn.classList.remove('inking');
      inkRO.unobserve(pn);
      svg.remove();
      pn.inkSvg = null;
    });
  });

  /* ── Halftone print-in: drop the mask once the dots have grown ───── */

  document.addEventListener('animationend', (e) => {
    if (e.animationName === 'ht-print') e.target.classList.add('printed');
  });

  /* ── Speed lines while the page flies by ─────────────────────────── */

  const lines = document.createElement('div');
  lines.className = 'fx-speed';
  lines.setAttribute('aria-hidden', 'true');
  document.body.append(lines);
  let lastY = window.scrollY;
  let vel = 0;
  let flying = false;
  function fly() {
    const y = window.scrollY;
    vel = vel * 0.8 + Math.abs(y - lastY) * 0.2;
    lastY = y;
    const o = Math.max(0, Math.min(0.55, (vel - 30) / 90));
    lines.style.opacity = o.toFixed(3);
    lines.classList.toggle('on', o > 0.01);
    if (vel > 0.5 && !still()) requestAnimationFrame(fly);
    else { flying = false; vel = 0; lines.classList.remove('on'); lines.style.opacity = '0'; }
  }
  window.addEventListener('scroll', () => {
    if (flying || still()) return;
    flying = true;
    requestAnimationFrame(fly);
  }, { passive: true });

  /* ── Panels tilt toward the pointer ──────────────────────────────── */

  if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
    document.querySelectorAll('.yonkoma .pn, .mpage .pn').forEach((pn) => {
      pn.addEventListener('pointermove', (e) => {
        const r = pn.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        pn.style.setProperty('--tx', `${(y * -7).toFixed(2)}deg`);
        pn.style.setProperty('--ty', `${(x * 9).toFixed(2)}deg`);
        pn.classList.add('tilting');
      });
      pn.addEventListener('pointerleave', () => {
        pn.style.setProperty('--tx', '0deg');
        pn.style.setProperty('--ty', '0deg');
        pn.classList.remove('tilting');
      });
    });
  }

  /* ── The live stage's payoff: a VERIFIED! stamp when a run checks out ─ */

  const stage = document.querySelector('[data-swarm]');
  const status = stage && stage.querySelector('[data-run-status]');
  if (stage && status && 'MutationObserver' in window) {
    stage.insertAdjacentHTML('beforeend', '<div class="stage-stamp" aria-hidden="true"><b>Verified!</b><small></small></div>');
    const stamp = stage.querySelector('.stage-stamp');
    let timer = 0;
    let was = status.dataset.state;
    new MutationObserver(() => {
      const now = status.dataset.state;
      if (now === 'verified' && was !== 'verified' && !still()) {
        const count = (status.textContent.match(/\d+ of \d+/) || [''])[0];
        stamp.querySelector('small').textContent = count;
        stamp.classList.remove('go');
        stage.classList.remove('thud');
        void stamp.offsetWidth;
        stamp.classList.add('go');
        stage.classList.add('thud');
        clearTimeout(timer);
        timer = setTimeout(() => { stamp.classList.remove('go'); stage.classList.remove('thud'); }, 2600);
      }
      was = now;
    }).observe(status, { attributes: true, attributeFilter: ['data-state'] });
  }

  /* ── 5. Motion-comic depth ───────────────────────────────────────── */

  const deep = [...document.querySelectorAll('.episode .pn, .yonkoma .pn')];
  let queued = false;
  function depth() {
    queued = false;
    const vh = window.innerHeight;
    for (const pn of deep) {
      if (!pn.classList.contains('vis')) continue;
      const r = pn.getBoundingClientRect();
      const c = (r.top + r.height / 2 - vh / 2) / vh;
      pn.style.setProperty('--par', Math.max(-1, Math.min(1, c)).toFixed(3));
    }
  }
  window.addEventListener('scroll', () => {
    if (queued || still()) return;
    queued = true;
    requestAnimationFrame(depth);
  }, { passive: true });
  depth();
})();
