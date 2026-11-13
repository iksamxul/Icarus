/* ICARUS showcase: the hero swarm, written for this page.

   The choreography: the lead cursor reads the task and splits it; four agent
   cursors fan out from the lead into their own tabs, act there, and hand back
   evidence; the lead visits each piece of evidence and marks it verified on
   the page. Then the scene clears and runs again.

   Motion is a critically damped spring per axis (no overshoot), solved in
   closed form each frame, so any frame time is stable. The two axes use
   slightly different stiffness, which bends each flight into a soft curve.

   Time runs on a simulation clock that only advances while the stage is on
   screen, the browser tab is visible and nobody pressed Pause. Pausing
   freezes the scene exactly where it is. With prefers-reduced-motion the
   stage shows one finished, still frame instead, and Play opts in. */
(() => {
  'use strict';

  const stage = document.querySelector('[data-swarm]');
  if (!stage) return;

  const root = document.documentElement;
  const layer = stage.querySelector('.swarm');
  const statusEl = stage.querySelector('[data-run-status]');
  const toggle = stage.querySelector('[data-swarm-toggle]');
  const reducedQuery = matchMedia('(prefers-reduced-motion: reduce)');
  const T = (name) => stage.querySelector(`[data-t="${name}"]`);
  const icon = (id) => `<svg class="ico" aria-hidden="true"><use href="#i-${id}"/></svg>`;

  /* ── Simulation clock ─────────────────────────────────────────────── */

  let now = 0;
  let timers = [];
  const sleep = (ms) => new Promise((resolve) => timers.push({ at: now + ms, resolve }));

  /* ── Springs ──────────────────────────────────────────────────────── */

  // x(t) = target + (c1 + c2 t) e^(-w t), c1 = x0 - target, c2 = v0 + w c1.
  function settle(x, v, target, w, dt) {
    const c1 = x - target;
    const c2 = v + w * c1;
    const e = Math.exp(-w * dt);
    return [target + (c1 + c2 * dt) * e, (c2 - w * (c1 + c2 * dt)) * e];
  }

  /* ── Cursors ──────────────────────────────────────────────────────── */

  const cursors = [];

  function makeCursor(id, colorVar, w, bend, lead) {
    const el = document.createElement('div');
    el.className = 'cur' + (lead ? ' lead' : '');
    el.style.setProperty('--c', `var(${colorVar})`);
    el.innerHTML = '<svg viewBox="0 0 24 24"><use href="#cur"/></svg><span class="cur-l"></span>';
    layer.append(el);
    const c = {
      id, el, colorVar, w, bend,
      label: el.querySelector('.cur-l'),
      x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0,
      target: null, arrived: true, onArrive: null,
      text: '', labelW: 0, flip: false, up: false,
    };
    cursors.push(c);
    return c;
  }

  const lead = makeCursor('lead', '--lead', 9, 1, true);
  const wing = makeCursor('wing', '--wing', 11, 0.8, false);
  const wax = makeCursor('wax', '--wax', 10, 1.18, false);
  const sun = makeCursor('sun', '--sun', 9.5, 0.84, false);
  const tide = makeCursor('tide', '--tide', 10.5, 1.12, false);
  // Helpers: they join when every roster agent is busy (the app's pool).
  const gust = makeCursor('gust', '--gust', 11.5, 0.86, false);
  const plume = makeCursor('plume', '--plume', 11, 1.1, false);
  const quill = makeCursor('quill', '--quill', 10.5, 0.9, false);
  const ember = makeCursor('ember', '--ember', 11.5, 1.14, false);
  const HELPERS = ['gust', 'plume', 'quill', 'ember'];
  const poolCount = document.querySelector('[data-pool-count]');

  function say(c, text) {
    if (c.text === text) return;
    c.text = text;
    c.label.textContent = text;
    c.labelW = c.label.offsetWidth;
  }
  function aim(c, el, fx = 0.5, fy = 0.55) {
    c.target = { el, fx, fy };
    c.arrived = false;
    return new Promise((resolve) => { c.onArrive = resolve; });
  }
  function show(c, on = true) { c.el.classList.toggle('on', on); }

  function ring(c) {
    const r = document.createElement('i');
    r.className = 'ring';
    r.style.setProperty('--c', `var(${c.colorVar})`);
    r.style.setProperty('--x', `${c.x.toFixed(1)}px`);
    r.style.setProperty('--y', `${c.y.toFixed(1)}px`);
    r.addEventListener('animationend', () => r.remove(), { once: true });
    layer.append(r);
  }
  async function click(c, el) {
    c.el.classList.add('down');
    el.classList.add('is-pressed');
    ring(c);
    await sleep(120);
    c.el.classList.remove('down');
    el.classList.remove('is-pressed');
  }
  async function type(el, text, per) {
    el.classList.add('is-active');
    for (const ch of text) {
      el.textContent += ch;
      await sleep(per + Math.random() * 26);
    }
  }

  /* ── Evidence boxes ───────────────────────────────────────────────── */

  let boxes = [];

  function box(el, colorVar) {
    const b = document.createElement('div');
    b.className = 'box';
    b.style.setProperty('--c', `var(${colorVar})`);
    b.innerHTML = `<span class="box-tag">${icon('check')}Verified</span>`;
    layer.append(b);
    const entry = { el: b, of: el };
    boxes.push(entry);
    placeBoxes(layer.getBoundingClientRect());
    b.getBoundingClientRect();
    b.classList.add('on');
    return entry;
  }
  function boxFor(el) { return boxes.find((b) => b.of === el); }

  /* ── Status ───────────────────────────────────────────────────────── */

  const RUN = {
    planning: ['split', 'Planning'],
    acting: ['pointer', 'Acting'],
    checking: ['eye', 'Checking'],
    verified: ['check-circle', 'Verified'],
  };
  const TAB = {
    queued: ['clock', 'Queued'],
    acting: ['pointer', 'Acting'],
    mcp: ['plug', 'MCP call'],
    reading: ['eye', 'Reading'],
    done: ['check', 'Done'],
    verified: ['check-circle', 'Verified'],
  };
  function runStatus(state, extra = '') {
    statusEl.dataset.state = state;
    statusEl.innerHTML = `${icon(RUN[state][0])}<span>${RUN[state][1]}${extra}</span>`;
  }
  // The roster dock under the stage lights the segment of whoever works.
  function busy(id, on) {
    const el = document.querySelector(`[data-dock="${id}"]`);
    if (el) el.toggleAttribute('data-busy', on);
  }
  function tabStatus(id, state) {
    busy(id, state === 'acting' || state === 'mcp' || state === 'reading');
    const el = stage.querySelector(`[data-tab="${id}"] [data-st]`);
    if (el.dataset.state === state) return;
    el.dataset.state = state;
    el.innerHTML = `${icon(TAB[state][0])}<span>${TAB[state][1]}</span>`;
  }

  /* ── The pages: reset and finished states ─────────────────────────── */

  function setExpress(on) {
    T('wing-std').classList.toggle('on', !on);
    T('wing-exp').classList.toggle('on', on);
    T('wing-ship').textContent = on ? '$9.00' : '$0.00';
    T('wing-total').textContent = on ? '$57.00' : '$48.00';
  }
  function setPlaced() {
    const p = T('wing-place');
    p.className = 'pbtn is-done';
    p.innerHTML = `${icon('check')}Placed #5170`;
  }
  function setSaved() {
    T('wax-row').classList.add('is-saved');
    T('wax-page').classList.add('is-saved');
  }

  // A helper joins: its open slot becomes a tab, its outline in the dock's
  // pile fills in, and the dock counts it.
  function join(id, on = true) {
    const tab = stage.querySelector(`[data-tab="${id}"]`);
    if (tab) tab.classList.toggle('is-empty', !on);
    const glyph = document.querySelector(`.dock .pile [data-dock="${id}"]`);
    if (glyph) glyph.toggleAttribute('data-joined', on);
    const n = document.querySelectorAll('.dock .pile [data-joined]').length;
    if (poolCount) poolCount.textContent = n ? `+${n} helper${n > 1 ? 's' : ''} joined` : 'Up to 8 at once';
  }
  function setAttached(on) {
    const b = T('quill-btn');
    b.className = on ? 'pbtn is-done' : 'pbtn';
    if (on) b.innerHTML = `${icon('check')}Attached`;
    else b.textContent = 'Attach';
  }

  function resetPages() {
    setExpress(false);
    setAttached(false);
    for (const id of HELPERS) join(id, false);
    const p = T('wing-place');
    p.className = 'pbtn';
    p.textContent = 'Place order';
    for (const id of ['wax-item', 'wax-cost']) {
      const cell = T(id);
      cell.textContent = '';
      cell.classList.remove('is-active', 'is-pressed');
    }
    T('wax-row').classList.remove('is-saved');
    T('wax-page').classList.remove('is-saved');
    T('tide-scroll').classList.remove('is-scrolled');
    for (const id of ['wing', 'wax', 'sun', 'tide', ...HELPERS]) tabStatus(id, 'queued');
    busy('lead', false);
    for (const b of boxes) b.el.remove();
    boxes = [];
    for (const r of layer.querySelectorAll('.ring')) r.remove();
    for (const el of stage.querySelectorAll('.is-pressed')) el.classList.remove('is-pressed');
    for (const c of cursors) {
      c.el.classList.remove('down', 'on');
      c.target = null;
      c.onArrive = null;
    }
    runStatus('planning');
  }

  /* ── Each agent's part ────────────────────────────────────────────── */

  const AGENTS = [
    {
      id: 'wing', c: wing, evidence: () => T('wing-place'), proof: 'Placed #5170',
      async run(c) {
        tabStatus('wing', 'acting');
        say(c, 'click Express');
        await aim(c, T('wing-exp'), 0.5, 0.62);
        await click(c, T('wing-exp'));
        setExpress(true);
        await sleep(320);
        say(c, 'click Place order');
        const p = T('wing-place');
        await aim(c, p, 0.42, 0.62);
        await click(c, p);
        p.classList.add('is-busy');
        p.textContent = 'Placing…';
        await sleep(760);
        setPlaced();
        tabStatus('wing', 'done');
        say(c, '');
      },
    },
    {
      id: 'wax', c: wax, evidence: () => T('wax-row'), proof: 'row 4',
      async run(c) {
        tabStatus('wax', 'acting');
        const item = T('wax-item');
        const cost = T('wax-cost');
        say(c, 'click B4');
        await aim(c, item, 0.24, 0.62);
        await click(c, item);
        say(c, 'type Desk lamp');
        await type(item, 'Desk lamp', 50);
        item.classList.remove('is-active');
        say(c, 'click C4');
        await aim(c, cost, 0.34, 0.62);
        await click(c, cost);
        say(c, 'type $48.00');
        await type(cost, '$48.00', 58);
        say(c, 'press Enter');
        await sleep(280);
        cost.classList.remove('is-active');
        setSaved();
        tabStatus('wax', 'done');
        say(c, '');
      },
    },
    {
      id: 'sun', c: sun, evidence: () => T('sun-row'), proof: '#4821',
      async run(c) {
        tabStatus('sun', 'mcp');
        say(c, 'mcp lookup_order');
        await aim(c, T('sun-list'), 0.66, 0.3);
        await sleep(900);
        tabStatus('sun', 'reading');
        say(c, 'read #4821');
        const row = T('sun-row');
        await aim(c, row, 0.16, 0.6);
        await sleep(140);
        box(row, '--sun');
        await sleep(380);
        tabStatus('sun', 'done');
        say(c, '');
      },
    },
    {
      id: 'tide', c: tide, evidence: () => T('tide-eta'), proof: '17 Nov',
      async run(c) {
        tabStatus('tide', 'reading');
        say(c, 'scroll');
        await aim(c, T('tide-page'), 0.58, 0.5);
        await sleep(140);
        T('tide-scroll').classList.add('is-scrolled');
        await sleep(560);
        say(c, 'read 17 Nov');
        const eta = T('tide-eta');
        await aim(c, eta, 0.3, 0.62);
        await sleep(140);
        box(eta, '--tide');
        await sleep(360);
        tabStatus('tide', 'done');
        say(c, '');
      },
    },
    {
      id: 'gust', c: gust, helper: true, evidence: () => T('gust-ev'), proof: 'in stock',
      async run(c) {
        tabStatus('gust', 'reading');
        say(c, 'check stock');
        const ev = T('gust-ev');
        await aim(c, ev, 0.3, 0.62);
        await sleep(140);
        box(ev, '--gust');
        await sleep(300);
        tabStatus('gust', 'done');
        say(c, '');
      },
    },
    {
      id: 'plume', c: plume, helper: true, evidence: () => T('plume-ev'), proof: 'address',
      async run(c) {
        tabStatus('plume', 'reading');
        say(c, 'read address');
        const ev = T('plume-ev');
        await aim(c, ev, 0.3, 0.62);
        await sleep(160);
        box(ev, '--plume');
        await sleep(320);
        tabStatus('plume', 'done');
        say(c, '');
      },
    },
    {
      id: 'quill', c: quill, helper: true, evidence: () => T('quill-btn'), proof: 'receipt',
      async run(c) {
        tabStatus('quill', 'acting');
        say(c, 'click Attach');
        const b = T('quill-btn');
        await aim(c, b, 0.45, 0.62);
        await click(c, b);
        await sleep(380);
        setAttached(true);
        tabStatus('quill', 'done');
        say(c, '');
      },
    },
    {
      id: 'ember', c: ember, helper: true, evidence: () => T('ember-ev'), proof: 'budget',
      async run(c) {
        tabStatus('ember', 'reading');
        say(c, 'read budget');
        const ev = T('ember-ev');
        await aim(c, ev, 0.3, 0.62);
        await sleep(150);
        box(ev, '--ember');
        await sleep(300);
        tabStatus('ember', 'done');
        say(c, '');
      },
    },
  ];

  /* ── One run, start to finish ─────────────────────────────────────── */

  function homeOf(el, fx, fy) {
    const lr = layer.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    return [r.left - lr.left + r.width * fx, r.top - lr.top + r.height * fy];
  }

  async function cycle() {
    resetPages();
    lead.w = 9;
    const caret = T('caret');
    const [hx, hy] = homeOf(caret, 0, 0.7);
    lead.x = hx; lead.y = hy; lead.vx = 0; lead.vy = 0;
    aim(lead, caret, 0, 0.7);
    say(lead, 'read task');
    show(lead);
    busy('lead', true);
    await sleep(950);
    say(lead, 'split into 8 jobs');
    await sleep(650);

    // The roster takes the first four jobs; with everyone busy, helpers
    // join for the rest, each from the lead, each into its own tab.
    const roster = AGENTS.filter((a) => !a.helper);
    const helpers = AGENTS.filter((a) => a.helper);
    let working = roster.length;
    runStatus('acting', ` · ${working} agents`);
    busy('lead', false);
    const finished = [];
    let wake = null;
    const launch = (a, delay, onStart) => {
      a.c.target = null;
      say(a.c, '');
      sleep(delay)
        .then(() => {
          if (onStart) onStart();
          a.c.x = lead.x; a.c.y = lead.y; a.c.vx = 0; a.c.vy = 0;
          show(a.c);
          return a.run(a.c);
        })
        .then(() => {
          working -= 1;
          if (working) runStatus('acting', ` · ${working} agent${working > 1 ? 's' : ''}`);
          else runStatus('checking');
          finished.push(a);
          if (wake) wake();
        });
    };
    roster.forEach((a, i) => launch(a, i * 110));
    sleep(520).then(() => say(lead, `all busy: +${helpers.length} helpers`));
    helpers.forEach((a, i) => launch(a, 720 + i * 150, () => {
      join(a.id);
      working += 1;
      runStatus('acting', ` · ${working} agents`);
    }));
    sleep(720 + helpers.length * 150 + 700).then(() => { if (lead.text.startsWith('all busy')) say(lead, ''); });

    lead.w = 13; // eight checks: the lead moves briskly between them
    for (let k = 0; k < AGENTS.length; k += 1) {
      if (!finished.length) {
        if (k > 0) say(lead, '');
        await new Promise((resolve) => { wake = resolve; });
        wake = null;
      }
      const a = finished.shift();
      const ev = a.evidence();
      say(lead, `verify ${a.proof}`);
      busy('lead', true);
      await aim(lead, ev, a.id === 'wax' ? 0.62 : 0.5, 0.5);
      await sleep(120);
      (boxFor(ev) || box(ev, a.c.colorVar)).el.classList.add('ok');
      tabStatus(a.id, 'verified');
      await sleep(150);
      busy('lead', false);
    }

    say(lead, `${AGENTS.length} of ${AGENTS.length} verified`);
    busy('lead', true);
    await aim(lead, statusEl, 0.3, 0.62);
    runStatus('verified', ` · ${AGENTS.length} of ${AGENTS.length}`);
    busy('lead', false);
    await sleep(2600);

    for (const c of cursors) show(c, false);
    for (const b of boxes) b.el.classList.remove('on');
    await sleep(520);
  }

  /* ── The still frame (reduced motion) ─────────────────────────────── */

  let stillWide = true;

  function renderStill() {
    resetPages();
    setExpress(true);
    setPlaced();
    T('wax-item').textContent = 'Desk lamp';
    T('wax-cost').textContent = '$48.00';
    setSaved();
    T('tide-scroll').classList.add('is-scrolled');
    for (const id of HELPERS) join(id);
    setAttached(true);
    for (const a of AGENTS) {
      tabStatus(a.id, 'verified');
      box(a.evidence(), a.c.colorVar).el.classList.add('ok');
    }
    const still = [
      [wing, T('wing-place'), 0.42, 0.62, 'click Place order'],
      [wax, T('wax-cost'), 0.34, 0.62, 'type $48.00'],
      [sun, T('sun-row'), 0.16, 0.6, 'read #4821'],
      [tide, T('tide-eta'), 0.3, 0.62, 'read 17 Nov'],
      [gust, T('gust-ev'), 0.3, 0.62, 'check stock'],
      [plume, T('plume-ev'), 0.3, 0.62, 'read address'],
      [quill, T('quill-btn'), 0.45, 0.62, 'click Attach'],
      [ember, T('ember-ev'), 0.3, 0.62, 'read budget'],
      [lead, statusEl, 0.3, 0.62, '8 of 8 verified'],
    ];
    // On a narrow stage five labels would cover the evidence they point
    // at; the boxes and status chips already tell the story there.
    stillWide = layer.clientWidth >= 700;
    for (const [c, el, fx, fy, text] of still) {
      aim(c, el, fx, fy);
      c.onArrive = null;
      say(c, stillWide ? text : '');
      show(c);
    }
    runStatus('verified', ` · ${AGENTS.length} of ${AGENTS.length}`);
    place(0, true);
  }

  /* ── Layout and integration ───────────────────────────────────────── */

  // One pass: read every rectangle first, then write every transform.
  // dt > 0 integrates the springs. dt = 0 is a layout-only pass: with snap
  // (the still frame) every cursor lands on its target; without it (a
  // paused scene being resized) only cursors that already arrived follow
  // their element, and nothing counts as a new arrival.
  function place(dt = 0, snap = false) {
    const lr = layer.getBoundingClientRect();
    const W = lr.width;
    const H = lr.height;
    for (const c of cursors) {
      if (!c.target) continue;
      const r = c.target.el.getBoundingClientRect();
      c.tx = r.left - lr.left + r.width * c.target.fx;
      c.ty = r.top - lr.top + r.height * c.target.fy;
    }
    const rects = boxRects(lr);

    for (const c of cursors) {
      if (!c.target) continue;
      if (dt > 0) {
        [c.x, c.vx] = settle(c.x, c.vx, c.tx, c.w, dt);
        [c.y, c.vy] = settle(c.y, c.vy, c.ty, c.w * c.bend, dt);
      } else if (snap || c.arrived) {
        c.x = c.tx; c.y = c.ty; c.vx = 0; c.vy = 0;
      }
      if ((dt > 0 || snap) && !c.arrived && Math.abs(c.tx - c.x) < 1.5 && Math.abs(c.ty - c.y) < 1.5) {
        c.arrived = true;
        const done = c.onArrive;
        c.onArrive = null;
        if (done) done();
      }
    }

    for (const c of cursors) {
      c.el.style.transform = `translate3d(${c.x.toFixed(2)}px, ${c.y.toFixed(2)}px, 0)`;
      const flip = c.x + 15 + c.labelW > W - 10;
      const up = c.y + 50 > H;
      if (flip !== c.flip) { c.flip = flip; c.el.classList.toggle('flip', flip); }
      if (up !== c.up) { c.up = up; c.el.classList.toggle('up', up); }
    }
    writeBoxes(rects);
  }

  function boxRects(lr) {
    return boxes.map((b) => {
      const r = b.of.getBoundingClientRect();
      return [r.left - lr.left - 5, r.top - lr.top - 4, r.width + 10, r.height + 8];
    });
  }
  // Only touch a box when it actually moved or resized: a width or height
  // write forces layout, and boxes sit still most of the time.
  function writeBoxes(rects) {
    boxes.forEach((b, i) => {
      const [x, y, w, h] = rects[i];
      const key = `${x.toFixed(1)},${y.toFixed(1)},${w.toFixed(1)},${h.toFixed(1)}`;
      if (b.key === key) return;
      b.key = key;
      b.el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
      b.el.style.width = `${w.toFixed(1)}px`;
      b.el.style.height = `${h.toFixed(1)}px`;
    });
  }
  function placeBoxes(lr) { writeBoxes(boxRects(lr)); }

  let raf = 0;
  let last = 0;
  function frame(t) {
    const dt = Math.min(0.05, Math.max(0, (t - last) / 1000));
    last = t;
    now += dt * 1000;
    if (timers.length) {
      const due = timers.filter((x) => x.at <= now);
      if (due.length) {
        timers = timers.filter((x) => x.at > now);
        for (const x of due) x.resolve();
      }
    }
    place(dt);
    raf = requestAnimationFrame(frame);
  }

  /* ── Run control ──────────────────────────────────────────────────── */

  let mode = '';          // 'anim' or 'still'
  let generation = 0;
  let visible = false;
  let userPaused = false;
  let optIn = false;

  const motionAllowed = () => !reducedQuery.matches || optIn;

  async function loop(gen) {
    // A new generation drops every pending timer, so an old loop simply
    // never wakes again; no flags to check inside the choreography.
    while (gen === generation) await cycle();
  }

  function setMode(next) {
    if (mode === next) return;
    mode = next;
    generation += 1;
    timers = [];
    stage.toggleAttribute('data-still', next === 'still');
    if (next === 'still') renderStill();
    else loop(generation);
  }

  function sync() {
    setMode(motionAllowed() ? 'anim' : 'still');
    const run = mode === 'anim' && visible && !document.hidden && !userPaused;
    if (run && !raf) {
      last = performance.now();
      raf = requestAnimationFrame(frame);
    } else if (!run && raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
    stage.toggleAttribute('data-frozen', !run);
    stage.toggleAttribute('data-running', run);
    root.toggleAttribute('data-swarm-live', run);

    const playing = mode === 'anim' && !userPaused;
    toggle.innerHTML = `${icon(playing ? 'pause' : 'play')}<span>${playing ? 'Pause' : 'Play'}</span>`;
    toggle.setAttribute('aria-label', playing ? 'Pause the animation' : 'Play the animation');
    window.dispatchEvent(new Event('swarm:state'));
  }

  toggle.addEventListener('click', () => {
    if (!motionAllowed()) { optIn = true; userPaused = false; }
    else userPaused = !userPaused;
    sync();
  });

  new IntersectionObserver((entries) => {
    visible = entries[entries.length - 1].isIntersecting;
    sync();
  }).observe(stage);
  document.addEventListener('visibilitychange', sync);
  reducedQuery.addEventListener('change', () => { optIn = false; sync(); });

  // Frozen or still, keep everything pinned to its element when the layout
  // changes (resize, theme, fonts); while running, the frame loop does it.
  const relayout = () => {
    if (raf) return;
    if (mode === 'still' && (layer.clientWidth >= 700) !== stillWide) renderStill();
    else place(0, mode === 'still');
  };
  new ResizeObserver(relayout).observe(stage);
  window.addEventListener('swarm:relayout', relayout);

  // Measure labels once the real fonts are in.
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => {
      for (const c of cursors) c.labelW = c.label.offsetWidth;
      relayout();
    });
  }

  sync();
})();
