/* ICARUS showcase: theme, the nav's glass rule, reveals, the flow diagram's
   connectors and the copy buttons. No dependencies. */
(() => {
  'use strict';

  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const announce = document.querySelector('[data-announce]');

  /* ── Theme ────────────────────────────────────────────────────────── */

  const THEME_KEY = 'icarus.showcase.theme';
  const themeButtons = document.querySelectorAll('[data-theme-set]');
  const themeMeta = document.querySelector('meta[name="theme-color"]');

  function applyTheme(theme) {
    root.setAttribute('data-theme', theme);
    themeButtons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.themeSet === theme)));
    if (themeMeta) themeMeta.setAttribute('content', theme === 'light' ? '#fff3dc' : '#120d26');
    window.dispatchEvent(new Event('swarm:relayout'));
  }
  applyTheme(root.getAttribute('data-theme') === 'light' ? 'light' : 'dark');
  themeButtons.forEach((b) => b.addEventListener('click', () => {
    if (b.dataset.themeSet === root.getAttribute('data-theme')) return;
    // A short crossfade between themes where the browser can do it and
    // motion is welcome; otherwise the switch is instant.
    if (document.startViewTransition && !reduced.matches) document.startViewTransition(() => applyTheme(b.dataset.themeSet));
    else applyTheme(b.dataset.themeSet);
    try { localStorage.setItem(THEME_KEY, b.dataset.themeSet); } catch (e) { /* private mode */ }
  }));

  /* ── The nav steps aside while the swarm animates under it ─────────
     The nav is the only pane with a backdrop filter. Anything moving
     behind it would make it re-blur every frame, so while the running
     stage crosses the nav's band, the nav slides up out of the way and
     comes back once the stage has passed. A still or paused stage never
     moves it. Keyboard focus inside the nav always brings it back. */

  const nav = document.querySelector('[data-nav]');
  const glassAvoid = [...document.querySelectorAll('[data-glass-avoid]')];
  let navQueued = false;

  /* Scroll spy: the nav's glass pill follows the section being read. It
     appears in place the first time, then slides between links. */
  const links = [...document.querySelectorAll('.nav-links a[href^="#"]')];
  const sections = links.map((a) => document.querySelector(a.getAttribute('href')));
  const pill = document.querySelector('.nav-pill');
  let current;

  function spy(force) {
    const line = innerHeight * 0.4;
    const atEnd = scrollY + innerHeight >= document.documentElement.scrollHeight - 2;
    let active = null;
    sections.forEach((sec, i) => { if (sec && sec.getBoundingClientRect().top <= line) active = links[i]; });
    if (atEnd && links.length) active = links[links.length - 1];
    if (active === current && !force) return;
    const appearing = !current;
    current = active;
    links.forEach((a) => {
      if (a === active) a.setAttribute('aria-current', 'location');
      else a.removeAttribute('aria-current');
    });
    if (!pill) return;
    if (!active) { pill.classList.remove('on'); return; }
    pill.classList.toggle('jump', appearing || force === true);
    pill.style.setProperty('--x', `${active.offsetLeft}px`);
    pill.style.setProperty('--w', `${active.offsetWidth}px`);
    pill.classList.add('on');
    if (pill.classList.contains('jump')) requestAnimationFrame(() => requestAnimationFrame(() => pill.classList.remove('jump')));
  }
  window.addEventListener('resize', () => spy(true));
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => spy(true));

  function checkNav() {
    navQueued = false;
    spy();
    // Any live region (the hero swarm, the 3D prologue) that is running
    // and crosses the nav's band sends the nav up out of the way.
    const band = nav.offsetTop + nav.offsetHeight + 10;
    const away = glassAvoid.some((el) => {
      if (!el.hasAttribute('data-running')) return false;
      const r = el.getBoundingClientRect();
      return r.top < band && r.bottom > 0;
    });
    nav.toggleAttribute('data-away', away);
  }
  function queueNav() {
    if (navQueued) return;
    navQueued = true;
    requestAnimationFrame(checkNav);
  }
  window.addEventListener('scroll', queueNav, { passive: true });
  window.addEventListener('resize', queueNav);
  window.addEventListener('swarm:state', queueNav);
  checkNav();

  /* ── Reveals ──────────────────────────────────────────────────────── */

  if (!reduced.matches && 'IntersectionObserver' in window) {
    root.classList.add('motion');
    const seen = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) { e.target.classList.add('in'); seen.unobserve(e.target); }
      }
    }, { rootMargin: '0px 0px -6% 0px' });
    document.querySelectorAll('.reveal').forEach((el) => seen.observe(el));
  }
  reduced.addEventListener('change', () => {
    if (reduced.matches) {
      root.classList.remove('motion');
      document.querySelectorAll('.reveal').forEach((el) => el.classList.add('in'));
    }
  });

  /* ── Flow diagram connectors ──────────────────────────────────────────
     Drawn from the nodes' real positions, so the same code serves the
     wide layout (columns, curves between them) and the narrow one (rows,
     with the lines bundled down the gutters beside the text). */

  const flow = document.querySelector('[data-flow]');
  // The roster, then the pool of helpers (dashed: they come and go).
  const IDS = ['wing', 'wax', 'sun', 'tide', 'pool'];
  const COLOR = { pool: 'text-faint' };

  function drawFlow() {
    if (!flow) return;
    const svg = flow.querySelector('.flow-lines');
    const fr = flow.getBoundingClientRect();
    const box = (el) => {
      const r = el.getBoundingClientRect();
      const l = r.left - fr.left;
      const t = r.top - fr.top;
      return { l, t, r: l + r.width, b: t + r.height, cx: l + r.width / 2, cy: t + r.height / 2 };
    };
    const lead = box(flow.querySelector('[data-node="lead"]'));
    const verify = box(flow.querySelector('[data-node="verify"]'));
    const agents = IDS.map((id) => box(flow.querySelector(`[data-node="a-${id}"]`)));
    const tabs = IDS.map((id) => box(flow.querySelector(`[data-node="t-${id}"]`)));
    const stacked = verify.t > Math.max(...tabs.map((t) => t.b));

    const W = fr.width;
    const k = 9;
    let out = '';
    const path = (d, id) => { out += `<path d="${d}"${id === 'pool' ? ' class="dash"' : ''} style="--c:var(--${COLOR[id] || id})"/>`; };
    const dot = (x, y, id) => { out += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.6" style="--c:var(--${COLOR[id] || id})"/>`; };
    const f = (n) => n.toFixed(1);

    IDS.forEach((id, i) => {
      const a = agents[i];
      const t = tabs[i];
      if (!stacked) {
        const m1 = (lead.r + a.l) / 2;
        path(`M${f(lead.r)} ${f(lead.cy)} C${f(m1)} ${f(lead.cy)} ${f(m1)} ${f(a.cy)} ${f(a.l)} ${f(a.cy)}`, id);
        path(`M${f(a.r)} ${f(a.cy)} L${f(t.l)} ${f(t.cy)}`, id);
        const m2 = (t.r + verify.l) / 2;
        path(`M${f(t.r)} ${f(t.cy)} C${f(m2)} ${f(t.cy)} ${f(m2)} ${f(verify.cy)} ${f(verify.l)} ${f(verify.cy)}`, id);
        dot(a.l, a.cy, id); dot(t.l, t.cy, id); dot(verify.l, verify.cy + (i - 1.5) * 0.01, id);
      } else {
        // Gutter spines: four parallel lines, one per agent.
        const gx = 7 + i * 3.2;
        const ly = lead.cy + (i - 2) * 3.2;
        path(`M${f(lead.l)} ${f(ly)} H${f(gx + k)} Q${f(gx)} ${f(ly)} ${f(gx)} ${f(ly + k)} V${f(a.cy - k)} Q${f(gx)} ${f(a.cy)} ${f(gx + k)} ${f(a.cy)} H${f(a.l)}`, id);
        path(`M${f(a.r)} ${f(a.cy)} H${f(t.l)}`, id);
        const rx = W - 7 - (IDS.length - 1 - i) * 3.2;
        const vy = verify.cy + (i - 2) * 3.2;
        path(`M${f(t.r)} ${f(t.cy)} H${f(rx - k)} Q${f(rx)} ${f(t.cy)} ${f(rx)} ${f(t.cy + k)} V${f(vy - k)} Q${f(rx)} ${f(vy)} ${f(rx - k)} ${f(vy)} H${f(verify.r)}`, id);
        dot(a.l, a.cy, id); dot(t.l, t.cy, id);
      }
    });
    svg.setAttribute('viewBox', `0 0 ${f(W)} ${f(fr.height)}`);
    svg.innerHTML = out;
  }

  if (flow) {
    new ResizeObserver(drawFlow).observe(flow);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(drawFlow);
    drawFlow();
  }

  /* ── Copy buttons ─────────────────────────────────────────────────── */

  document.querySelectorAll('[data-copy]').forEach((btn) => {
    let timer = 0;
    btn.addEventListener('click', async () => {
      const text = btn.dataset.copy;
      let ok = false;
      try {
        await navigator.clipboard.writeText(text);
        ok = true;
      } catch (e) {
        // No clipboard access (an http origin that is not localhost, say):
        // select the command so it is one keystroke away.
        const code = btn.parentElement.querySelector('code');
        const range = document.createRange();
        range.selectNodeContents(code);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
      }
      const label = btn.querySelector('span');
      const use = btn.querySelector('use');
      btn.toggleAttribute('data-done', ok);
      label.textContent = ok ? 'Copied' : 'Selected';
      use.setAttribute('href', ok ? '#i-check' : '#i-copy');
      if (announce) announce.textContent = ok ? `Copied ${text}` : `Selected ${text}`;
      clearTimeout(timer);
      timer = setTimeout(() => {
        btn.removeAttribute('data-done');
        label.textContent = 'Copy';
        use.setAttribute('href', '#i-copy');
      }, 1800);
    });
  });
})();

/* Back to top: the orb shows once the cover is behind you, its ring fills
   with how far down the page you are, and a press flies you back up (no
   flight with reduced motion). Focus lands on the brand at the top. */
(() => {
  const btn = document.querySelector('[data-to-top]');
  if (!btn) return;
  const bar = btn.querySelector('.bar');
  let queued = false;
  const update = () => {
    queued = false;
    const y = window.scrollY;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    btn.toggleAttribute('data-show', y > window.innerHeight * 0.9);
    if (bar) bar.style.strokeDashoffset = String(100 - Math.min(100, (y / Math.max(1, max)) * 100));
  };
  const queue = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(update);
  };
  window.addEventListener('scroll', queue, { passive: true });
  window.addEventListener('resize', queue);
  update();
  btn.addEventListener('click', () => {
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: still ? 'auto' : 'smooth' });
    document.querySelector('.nav .brand')?.focus({ preventScroll: true });
  });
})();
