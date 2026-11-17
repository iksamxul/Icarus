/* ICARUS showcase: the swarm in toon-shaded 3D (Three.js r180, vendored).

   1. The cast. Each cursor is the page's arrow, extruded and bevelled, lit
      with cel shading (three flat bands), an ink outline and a face painted
      on its front: neutral, happy, shock, nervous, stern, sparkle, cry,
      sleepy, cool, and a blink frame. Every colour and expression the page
      uses is rendered once into an image, a few at a time so loading never
      stalls, which makes every character a crisp 3D asset that costs
      nothing per frame.
   2. The prologue. A live scene at the app's real limit, the lead and 24
      agents, that drifts as a loose cloud and gathers into a pair of wings
      as you scroll. It renders only while on screen and the tab is visible,
      caps the pixel ratio, and marks itself running so the glass nav steps
      aside: nothing moves behind glass. With reduced motion it draws one
      still frame.

   Without WebGL nothing breaks: the flat cursors stay, the comic shows its
   flat characters, and the prologue keeps its words. */
import * as THREE from 'three';

const root = document.documentElement;
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const INK = '#120f1a';

const COLORS = {
  lead: '#f3efe6', you: '#a3abba',
  wing: '#38b6ff', wax: '#ff5fa2', sun: '#f5b83d', tide: '#8b6cff',
  gust: '#45ed53', plume: '#8445ed', quill: '#edb545', ember: '#45ede6',
};

// The app's colour rule for agents past the fixed six (src/shared/types.ts).
const FIXED = ['#38b6ff', '#ff5fa2', '#f5b83d', '#8b6cff', '#3ddc97', '#ff8a4c'];
function agentColor(i) {
  if (i < FIXED.length) return FIXED[i];
  const h = ((i * 137.508 + 20) % 360) / 360;
  const s = 0.82;
  const l = 0.6;
  const f = (n) => {
    const k = (n + h * 12) % 12;
    const a = s * Math.min(l, 1 - l);
    const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(c * 255).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/* ── Geometry, material, light ─────────────────────────────────────── */

// The page's arrow in SVG units (y down), tip first.
const ARROW = [[5, 3.2], [5, 19.1], [9.4, 15.3], [12.3, 21.5], [15.3, 20.1], [12.4, 14], [18.5, 14]];
const DEPTH = 1.3;
const BEVEL = 0.5;

function arrowGeometry(segments, grow = 0) {
  const shape = new THREE.Shape();
  ARROW.forEach(([x, y], i) => (i ? shape.lineTo(x - 5, 3.2 - y) : shape.moveTo(x - 5, 3.2 - y)));
  shape.closePath();
  // Tip at the origin, the front cap facing +z. grow > 0 makes the shell
  // used for the ink outline.
  return new THREE.ExtrudeGeometry(shape, {
    depth: DEPTH, bevelEnabled: true,
    bevelThickness: BEVEL + grow * 0.7, bevelSize: 0.4 + grow,
    bevelSegments: segments, curveSegments: 1,
  });
}

function rampTexture() {
  const t = new THREE.DataTexture(new Uint8Array([92, 168, 255]), 3, 1, THREE.RedFormat);
  t.minFilter = THREE.NearestFilter;
  t.magFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  return t;
}

function toonLights(scene) {
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8fb8, 1.15));
  const key = new THREE.DirectionalLight(0xffffff, 2.3);
  key.position.set(-7, 12, 14);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xffe8c8, 1.1);
  rim.position.set(12, 3, 5);
  scene.add(rim);
}

/* ── Faces, painted on the front cap ───────────────────────────────── */

// The cap's UVs are its own x, y in arrow units: x from -1 to 14.5, y from
// 1 down to -19.3. The canvas covers exactly that, one unit = U pixels.
const UNITS_W = 15.5;
const UNITS_H = 20.3;

function faceCanvas() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = Math.round((512 * UNITS_H) / UNITS_W);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.repeat.set(1 / UNITS_W, 1 / UNITS_H);
  tex.offset.set(1 / UNITS_W, 19.3 / UNITS_H);
  tex.anisotropy = 4;
  return { canvas, ctx: canvas.getContext('2d'), tex };
}

function paintFace(ctx, color, face) {
  const U = ctx.canvas.width / UNITS_W;
  const X = (x) => (x + 1) * U;
  const Y = (y) => (1 - y) * U;
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;
  ctx.globalAlpha = 1;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, W, H);
  // Manhwa-style soft colouring under the cel bands: a lit top-left, a
  // cooler shadow toward the tail, and a gloss streak by the tip.
  const g = ctx.createLinearGradient(X(0), Y(0), X(9), Y(-15));
  g.addColorStop(0, 'rgba(255,255,255,0.38)');
  g.addColorStop(0.45, 'rgba(255,255,255,0)');
  g.addColorStop(1, 'rgba(36,12,70,0.26)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.beginPath();
  ctx.ellipse(X(1.5), Y(-3.1), 0.42 * U, 1.5 * U, -0.62, 0, Math.PI * 2);
  ctx.fill();
  if (face === 'none') return;

  const ink = (w) => { ctx.strokeStyle = INK; ctx.lineWidth = w * U; };
  const ell = (x, y, rx, ry) => { ctx.beginPath(); ctx.ellipse(X(x), Y(y), rx * U, ry * U, 0, 0, Math.PI * 2); };
  const L = [2.6, -7.3];
  const R = [5.8, -7.3];

  const eye = ([cx, cy], o = {}) => {
    const { rx = 1.0, ry = 1.3, px = 0.1, py = 0.1, pr = 0.6, shine = true, star = false } = o;
    ell(cx, cy, rx, ry);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ink(0.2);
    ctx.stroke();
    // Iris: deep ink with a coloured glint, the way manhwa paints eyes.
    const ig = ctx.createRadialGradient(X(cx + px), Y(cy + py - pr * 0.4), 0, X(cx + px), Y(cy + py), pr * 1.2 * U);
    ig.addColorStop(0, color);
    ig.addColorStop(0.55, INK);
    ig.addColorStop(1, INK);
    ell(cx + px, cy + py, pr, pr * 1.18);
    ctx.fillStyle = ig;
    ctx.fill();
    if (shine) {
      ctx.fillStyle = '#ffffff';
      ell(cx + px - pr * 0.35, cy + py + pr * 0.45, pr * 0.34, pr * 0.34);
      ctx.fill();
      ell(cx + px + pr * 0.3, cy + py - pr * 0.4, pr * 0.16, pr * 0.16);
      ctx.fill();
    }
    if (star) {
      const sx = X(cx + px - pr * 0.25);
      const sy = Y(cy + py + pr * 0.25);
      const r = pr * 0.85 * U;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      for (let i = 0; i < 8; i += 1) {
        const a = (i * Math.PI) / 4;
        const rr = i % 2 ? r * 0.28 : r;
        ctx.lineTo(sx + Math.cos(a) * rr, sy + Math.sin(a) * rr);
      }
      ctx.closePath();
      ctx.fill();
    }
  };
  const arcEye = ([cx, cy], up, w = 0.3) => {
    ctx.beginPath();
    ctx.moveTo(X(cx - 0.85), Y(cy + (up ? -0.2 : 0.1)));
    ctx.quadraticCurveTo(X(cx), Y(cy + (up ? 0.8 : -0.55)), X(cx + 0.85), Y(cy + (up ? -0.2 : 0.1)));
    ink(w);
    ctx.stroke();
  };
  const line = (pts, w) => {
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y))));
    ink(w);
    ctx.stroke();
  };
  const smile = () => {
    ctx.beginPath();
    ctx.moveTo(X(3.3), Y(-9.8));
    ctx.quadraticCurveTo(X(4.2), Y(-10.7), X(5.1), Y(-9.8));
    ink(0.24);
    ctx.stroke();
  };
  const grin = () => {
    ctx.beginPath();
    ctx.moveTo(X(3.0), Y(-9.55));
    ctx.lineTo(X(5.4), Y(-9.55));
    ctx.quadraticCurveTo(X(4.2), Y(-11.5), X(3.0), Y(-9.55));
    ctx.fillStyle = '#5e1228';
    ctx.fill();
    ink(0.2);
    ctx.stroke();
    ell(4.2, -10.55, 0.5, 0.26);
    ctx.fillStyle = '#ff7f96';
    ctx.fill();
  };
  const oMouth = (rx, ry) => {
    ell(4.3, -10.35, rx, ry);
    ctx.fillStyle = '#3a0b1c';
    ctx.fill();
    ink(0.18);
    ctx.stroke();
  };
  const blush = (a = 0.5) => {
    for (const [x, y] of [[1.4, -9.0], [7.0, -9.0]]) {
      ell(x, y, 0.85, 0.45);
      ctx.fillStyle = `rgba(255,80,120,${a})`;
      ctx.fill();
      for (let i = -1; i <= 1; i += 1) line([[x + i * 0.32 - 0.12, y - 0.22], [x + i * 0.32 + 0.12, y + 0.22]], 0.09);
    }
  };

  switch (face) {
    case 'happy':
      arcEye(L, true);
      arcEye(R, true);
      grin();
      blush(0.55);
      break;
    case 'shock': {
      // Blue gloom across the brow, then white-out eyes and a gaping mouth.
      const sg = ctx.createLinearGradient(0, Y(-2), 0, Y(-7));
      sg.addColorStop(0, 'rgba(40,60,170,0.55)');
      sg.addColorStop(1, 'rgba(40,60,170,0)');
      ctx.fillStyle = sg;
      ctx.fillRect(0, Y(-1.5), W, Y(-7) - Y(-1.5));
      for (let x = 0.6; x < 9; x += 0.7) line([[x, -1.6], [x, -4.6 - (x % 1.4)]], 0.08);
      eye(L, { rx: 1.15, ry: 1.5, pr: 0.22, px: 0, py: 0, shine: false });
      eye(R, { rx: 1.15, ry: 1.5, pr: 0.22, px: 0, py: 0, shine: false });
      line([[1.6, -5.2], [3.5, -4.9]], 0.24);
      line([[4.9, -4.9], [6.8, -5.2]], 0.24);
      oMouth(0.62, 0.95);
      break;
    }
    case 'nervous':
      eye(L, { pr: 0.45, px: 0.38, py: 0.05 });
      eye(R, { pr: 0.45, px: 0.38, py: 0.05 });
      line([[1.8, -5.7], [3.4, -5.3]], 0.2);
      line([[5.0, -5.3], [6.6, -5.7]], 0.2);
      line([[3.1, -10.1], [3.5, -9.8], [3.9, -10.2], [4.3, -9.8], [4.7, -10.2], [5.1, -9.8], [5.4, -10.1]], 0.2);
      blush(0.35);
      break;
    case 'stern': {
      // A dark, hatched brow: the manga "don't you dare".
      ctx.save();
      ctx.globalAlpha = 0.35;
      for (let x = -0.5; x < 9.5; x += 0.45) line([[x, -1.8], [x + 1.2, -4.8]], 0.08);
      ctx.restore();
      eye(L, { pr: 0.5, py: -0.25 });
      eye(R, { pr: 0.5, py: -0.25 });
      // Heavy lids.
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(X(1.3), Y(-5.6)); ctx.lineTo(X(3.9), Y(-6.6)); ctx.lineTo(X(3.9), Y(-5.6)); ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(X(4.5), Y(-6.6)); ctx.lineTo(X(7.1), Y(-5.6)); ctx.lineTo(X(4.5), Y(-5.6)); ctx.closePath(); ctx.fill();
      line([[1.3, -5.7], [3.8, -6.6]], 0.42);
      line([[4.6, -6.6], [7.1, -5.7]], 0.42);
      line([[3.4, -10.15], [5.1, -10.35]], 0.3);
      break;
    }
    case 'sparkle':
      eye(L, { rx: 1.1, ry: 1.45, pr: 0.78, star: true });
      eye(R, { rx: 1.1, ry: 1.45, pr: 0.78, star: true });
      smile();
      blush(0.3);
      break;
    case 'cry':
      eye(L, { pr: 0.72, py: 0.2 });
      eye(R, { pr: 0.72, py: 0.2 });
      ctx.fillStyle = 'rgba(120,200,255,0.85)';
      for (const [x] of [L, R]) {
        ctx.beginPath();
        ctx.moveTo(X(x - 0.45), Y(-8.4));
        ctx.quadraticCurveTo(X(x - 0.55), Y(-11.5), X(x - 0.15), Y(-12.6));
        ctx.lineTo(X(x + 0.35), Y(-12.4));
        ctx.quadraticCurveTo(X(x + 0.2), Y(-10.5), X(x + 0.35), Y(-8.4));
        ctx.fill();
      }
      ctx.beginPath();
      ctx.moveTo(X(3.3), Y(-10.4));
      ctx.quadraticCurveTo(X(4.2), Y(-9.5), X(5.1), Y(-10.4));
      ink(0.24);
      ctx.stroke();
      break;
    case 'blink':
      arcEye(L, false, 0.28);
      arcEye(R, false, 0.28);
      smile();
      break;
    case 'sleepy':
      arcEye([L[0], L[1] - 0.2], false, 0.28);
      arcEye([R[0], R[1] - 0.2], false, 0.28);
      oMouth(0.32, 0.38);
      blush(0.35);
      break;
    case 'cool': {
      // Sunglasses, with a glare stripe.
      const lens = (x0, x1) => {
        ctx.beginPath();
        ctx.roundRect(X(x0), Y(-6.3), (x1 - x0) * U, 1.9 * U, 0.6 * U);
        ctx.fillStyle = INK;
        ctx.fill();
        ctx.save();
        ctx.clip();
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.fillRect(X(x0 + 0.3), Y(-6.3), 0.35 * U, 1.9 * U);
        ctx.restore();
      };
      lens(1.2, 3.9);
      lens(4.6, 7.4);
      line([[3.9, -6.9], [4.6, -6.9]], 0.24);
      ctx.beginPath();
      ctx.moveTo(X(3.6), Y(-10.0));
      ctx.quadraticCurveTo(X(4.7), Y(-10.6), X(5.5), Y(-9.6));
      ink(0.24);
      ctx.stroke();
      break;
    }
    default:
      eye(L);
      eye(R);
      smile();
  }
}

/* ── 1. Bake the cast ──────────────────────────────────────────────── */

const pause = () => new Promise((r) => setTimeout(r, 0));

async function bake(requests) {
  const S = 384;
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(1);
  renderer.setSize(S, S, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  toonLights(scene);
  const ramp = rampTexture();
  const { ctx, tex } = faceCanvas();

  const geo = arrowGeometry(5);
  const shell = arrowGeometry(5, 0.55);
  const cap = new THREE.MeshToonMaterial({ map: tex, gradientMap: ramp });
  const side = new THREE.MeshToonMaterial({ color: '#ffffff', gradientMap: ramp });
  const body = new THREE.Mesh(geo, [cap, side]);
  const outline = new THREE.Mesh(shell, new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide }));
  const pose = new THREE.Group();
  pose.add(body, outline);
  // A three-quarter pose: the face reads, the thickness shows.
  pose.rotation.set(-0.3, 0.44, 0.04);
  scene.add(pose);
  pose.updateMatrixWorld(true);
  const centre = new THREE.Box3().setFromObject(outline).getCenter(new THREE.Vector3());
  pose.position.sub(centre);
  pose.updateMatrixWorld(true);
  const size = new THREE.Box3().setFromObject(outline).getSize(new THREE.Vector3());

  const camera = new THREE.PerspectiveCamera(22, 1, 0.1, 500);
  const half = THREE.MathUtils.degToRad(11);
  camera.position.set(0, 0, (Math.max(size.x, size.y) * 0.5) / Math.tan(half) / 0.86 + size.z);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();

  // Where the tip lands, and the arrow's height in the image, so the page
  // can anchor each image at its tip and size it to any height.
  const tip = new THREE.Vector3(0, 0, DEPTH + BEVEL).applyMatrix4(body.matrixWorld).project(camera);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  let top = Infinity;
  let bottom = -Infinity;
  for (let i = 0; i < pos.count; i += 1) {
    v.fromBufferAttribute(pos, i).applyMatrix4(body.matrixWorld).project(camera);
    const y = (1 - v.y) / 2;
    if (y < top) top = y;
    if (y > bottom) bottom = y;
  }
  root.style.setProperty('--c3d-k', (1 / (bottom - top)).toFixed(4));
  root.style.setProperty('--c3d-fx', ((tip.x + 1) / 2).toFixed(4));
  root.style.setProperty('--c3d-fy', ((1 - tip.y) / 2).toFixed(4));

  const urls = new Map();
  for (const key of requests) {
    const [who, face] = key.split(':');
    const hex = COLORS[who] || COLORS.lead;
    paintFace(ctx, hex, face);
    tex.needsUpdate = true;
    side.color.set(hex).multiplyScalar(0.92);
    renderer.render(scene, camera);
    const blob = await new Promise((r) => renderer.domElement.toBlob(r, 'image/png'));
    urls.set(key, URL.createObjectURL(blob));
    await pause(); // a few at a time: keep the page responsive
  }
  geo.dispose(); shell.dispose(); cap.dispose(); side.dispose(); tex.dispose(); ramp.dispose();
  outline.material.dispose();
  renderer.dispose();
  renderer.forceContextLoss();
  return urls;
}

function colourOf(host) {
  if (host.dataset.who) return host.dataset.who;
  if (host.classList.contains('you')) return 'you';
  if (host.classList.contains('lead')) return 'lead';
  const m = /var\(--([a-z]+)\)/.exec(host.getAttribute('style') || '');
  return m && COLORS[m[1]] ? m[1] : null;
}
const BLINKS = new Set(['neutral', 'sparkle', 'nervous', 'stern', 'cry']);

async function cast() {
  // The hero's cursors (no faces: they are small and busy), then the comic's
  // characters in reading order, each with a blink frame where it blinks.
  const heroes = [...document.querySelectorAll('.cur > svg')].map((svg) => [svg, `${colourOf(svg.parentElement)}:none`]);
  const chars = [...document.querySelectorAll('.chr[data-who]')];
  const wanted = new Set(heroes.map(([, k]) => k));
  for (const el of chars) {
    const face = el.dataset.face || 'neutral';
    wanted.add(`${el.dataset.who}:${face}`);
    if (BLINKS.has(face) && !el.hasAttribute('data-noblink')) wanted.add(`${el.dataset.who}:blink`);
  }
  const keys = [...wanted].filter((k) => !k.startsWith('null'));
  const urls = await bake(keys);

  for (const [svg, key] of heroes) {
    if (!urls.has(key)) continue;
    const img = new Image();
    img.className = 'c3d';
    img.alt = '';
    img.decoding = 'async';
    img.src = urls.get(key);
    svg.after(img);
  }
  root.classList.add('has-3d');
  window.dispatchEvent(new Event('swarm:relayout'));

  for (const el of chars) {
    const face = el.dataset.face || 'neutral';
    const key = `${el.dataset.who}:${face}`;
    if (!urls.has(key)) continue;
    const img = new Image();
    img.className = 'chr-img';
    img.alt = '';
    img.decoding = 'async';
    img.src = urls.get(key);
    el.prepend(img);
    const blink = `${el.dataset.who}:blink`;
    if (BLINKS.has(face) && urls.has(blink) && !el.hasAttribute('data-noblink')) {
      const b = new Image();
      b.className = 'chr-blink';
      b.alt = '';
      b.decoding = 'async';
      b.src = urls.get(blink);
      img.after(b);
    }
    el.classList.add('is-3d');
  }
}

/* ── 2. The opening: the lead, the sun, and a swarm that becomes wings ─ */

// A comic ray burst for behind the sun, drawn once on a canvas.
function burstTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d');
  g.translate(256, 256);
  const n = 32;
  for (let i = 0; i < n; i += 1) {
    g.rotate((Math.PI * 2) / n);
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(260, -18);
    g.lineTo(260, 18);
    g.closePath();
    g.fillStyle = i % 2 ? 'rgba(255, 200, 61, 0.6)' : 'rgba(255, 138, 31, 0.38)';
    g.fill();
  }
  g.globalCompositeOperation = 'destination-in';
  const fade = g.createRadialGradient(0, 0, 70, 0, 0, 256);
  fade.addColorStop(0, 'rgba(0, 0, 0, 1)');
  fade.addColorStop(1, 'rgba(0, 0, 0, 0)');
  g.fillStyle = fade;
  g.fillRect(-256, -256, 512, 512);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function prologue(section) {
  // Size the stage first: the canvas measures it.
  section.classList.add('has-3d');
  const canvas = section.querySelector('canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  toonLights(scene);
  const camera = new THREE.PerspectiveCamera(34, 1, 1, 1400);
  const ramp = rampTexture();
  const inkMat = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide });

  // Seeded randomness: the same cloud on every visit.
  let seed = 7;
  const rand = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

  // The swarm: one instanced body and one ink shell sharing matrices.
  const geo = arrowGeometry(3);
  const shell = arrowGeometry(3, 0.6);
  for (const g of [geo, shell]) g.translate(-6.75, 9.15, -(DEPTH / 2)); // spin about the middle
  const N = 25; // the lead's place + 24 agents, the most the app runs at once
  const mesh = new THREE.InstancedMesh(geo, new THREE.MeshToonMaterial({ color: '#ffffff', gradientMap: ramp }), N);
  const ink = new THREE.InstancedMesh(shell, inkMat, N);
  ink.instanceMatrix = mesh.instanceMatrix; // one set of matrices for body and outline
  scene.add(ink, mesh);
  // Index 0 is the lead's place between the wings; the lead itself is its
  // own mesh below, wearing its face. 1..4 the roster, then helpers in the
  // app's own colour order.
  const palette = [COLORS.lead, FIXED[0], FIXED[1], FIXED[2], FIXED[3]];
  for (let i = 5; i < N; i += 1) palette.push(agentColor(i + 1));
  const color = new THREE.Color();
  for (let i = 0; i < N; i += 1) mesh.setColorAt(i, color.set(palette[i]));
  const hidden = new THREE.Matrix4().makeScale(0, 0, 0);

  // The lead, with its face painted on the front cap.
  const face = faceCanvas();
  paintFace(face.ctx, COLORS.lead, 'sparkle');
  face.tex.needsUpdate = true;
  const leadGeo = arrowGeometry(5);
  const leadShell = arrowGeometry(5, 0.55);
  for (const g of [leadGeo, leadShell]) g.translate(-6.75, 9.15, -(DEPTH / 2));
  const leadSide = new THREE.MeshToonMaterial({ color: COLORS.lead, gradientMap: ramp });
  leadSide.color.multiplyScalar(0.92);
  const lead = new THREE.Group();
  lead.add(
    new THREE.Mesh(leadGeo, [new THREE.MeshToonMaterial({ map: face.tex, gradientMap: ramp }), leadSide]),
    new THREE.Mesh(leadShell, inkMat),
  );
  lead.scale.setScalar(1.7);
  scene.add(lead);

  // The sun: a toon sphere with an ink rim, a slow comic burst behind it.
  const SUN_R = 34;
  const sun = new THREE.Group();
  sun.add(
    new THREE.Mesh(new THREE.SphereGeometry(SUN_R * 1.035, 48, 32), inkMat),
    new THREE.Mesh(
      new THREE.SphereGeometry(SUN_R, 64, 48),
      new THREE.MeshToonMaterial({ color: '#ffc83d', gradientMap: ramp, emissive: new THREE.Color('#ff8a1f'), emissiveIntensity: 0.32 }),
    ),
  );
  sun.position.set(18, 26, -92);
  scene.add(sun);
  const burst = new THREE.Mesh(
    new THREE.PlaneGeometry(SUN_R * 5.6, SUN_R * 5.6),
    new THREE.MeshBasicMaterial({ map: burstTexture(), transparent: true, depthWrite: false }),
  );
  burst.position.copy(sun.position).add(new THREE.Vector3(0, 0, -SUN_R * 1.4));
  scene.add(burst);

  const cloud = [];
  const wing = [];
  const spinA = [];
  const spinB = [];
  const formQ = [];
  const scaleOf = [];
  const e = new THREE.Euler();
  for (let i = 0; i < N; i += 1) {
    const r = 46 + rand() * 70;
    const a = rand() * Math.PI * 2;
    // Scattered behind the lead, never in front of its face.
    cloud.push(new THREE.Vector3(Math.cos(a) * r * 1.3, (rand() - 0.5) * 62 + 2, -38 - rand() * 72));
    spinA.push(new THREE.Quaternion().setFromEuler(e.set(rand() * 6.3, rand() * 6.3, rand() * 6.3)));
    spinB.push(new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).normalize());
    scaleOf.push(i <= 4 ? 1.25 : 1.05);
  }
  // Wings: twelve feathers a side, the roster on the leading edge.
  wing.push(new THREE.Vector3(0, 6, 6));
  formQ.push(new THREE.Quaternion().setFromEuler(e.set(0.1, 0, 0.12)));
  const perSide = (N - 1) / 2;
  const cols = 6;
  const rows = Math.ceil(perSide / cols);
  for (let k = 0; k < N - 1; k += 1) {
    const side = k % 2 === 0 ? -1 : 1;
    const j = Math.floor(k / 2);
    const row = Math.floor(j / cols);
    const col = j % cols;
    const u = (col + 0.5) / cols;
    const w = rows > 1 ? row / (rows - 1) : 0;
    const x = side * (7 + u * 62);
    const y = 10 + Math.sin(u * Math.PI * 0.85) * 16 - u * u * 10 - w * (6 + 20 * (1 - u * 0.55));
    const z = -u * 14 - w * 5;
    wing.push(new THREE.Vector3(x, y, z));
    const lean = side * (0.5 + u * 0.7) - side * w * 0.25;
    formQ.push(new THREE.Quaternion().setFromEuler(e.set(0.15, side > 0 ? Math.PI : 0, side > 0 ? lean : -lean)));
  }
  // On the cover the lead turns three-quarters to the reader, face first.
  const coverQ = new THREE.Quaternion().setFromEuler(e.set(-0.16, 0.34, 0.1));

  const m4 = new THREE.Matrix4();
  const p = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const qs = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const look = new THREE.Vector3();
  const coverLook = new THREE.Vector3();
  const wingLook = new THREE.Vector3();
  const ease = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : (1 - (1 + 7 * t) * Math.exp(-7 * t)) / (1 - 8 * Math.exp(-7)));
  const smooth = (t) => t * t * (3 - 2 * t);
  const clamp = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

  let progress = parseFloat(section.dataset.p || '0') || 0;
  let fitR = 160;
  let pointer = 0;
  let pointerTo = 0;

  function draw(time) {
    const t = time / 1000;
    const still = reduced.matches;
    const k = ease(clamp((progress - 0.2) / 0.5)); // the swarm forms its wings
    const up = smooth(clamp((progress - 0.72) / 0.28)); // then Icarus climbs toward the sun
    const climb = up * 12;
    const back = up * 10;
    mesh.setMatrixAt(0, hidden);
    // The sun starts low and in frame beside the lead, then settles behind the wings.
    sun.position.set(-22 + 22 * k, 12 + 14 * k, -92);
    burst.position.set(sun.position.x, sun.position.y, sun.position.z - SUN_R * 1.4);
    for (let i = 1; i < N; i += 1) {
      const c = cloud[i];
      const f = wing[i];
      const drift = (1 - k) * 2.2;
      const beat = Math.sin(t * 1.5) * 0.07 * (k + up * 0.6) * Math.abs(f.x);
      p.set(
        c.x + (f.x - c.x) * k + Math.sin(t * 0.4 + i) * drift,
        c.y + (f.y - c.y) * k + Math.cos(t * 0.5 + i * 1.7) * drift + beat + climb * k,
        c.z + (f.z - c.z) * k - back * k,
      );
      qs.setFromAxisAngle(spinB[i], t * 0.35 * (1 - k)).multiply(spinA[i]);
      q.copy(qs).slerp(formQ[i], k);
      const sc = scaleOf[i] * (1.1 - 0.1 * k);
      s.set(sc, sc, sc);
      mesh.setMatrixAt(i, m4.compose(p, q, s));
    }
    mesh.instanceMatrix.needsUpdate = true;

    const bob = still ? 0 : Math.sin(t * 1.3) * 0.9 * (1 - k * 0.5);
    lead.position.set(wing[0].x, wing[0].y + bob + climb, wing[0].z - back);
    lead.quaternion.copy(coverQ).slerp(formQ[0], k);
    if (!still) lead.rotateZ(Math.sin(t * 0.9) * 0.035);

    pointer += (pointerTo - pointer) * 0.06;
    const ang = 0.46 * (1 - k) - 0.05 + pointer * 0.1 + (still ? 0 : Math.sin(t * 0.15) * 0.03);
    const R = fitR * (0.42 + 0.58 * k + 0.06 * up);
    coverLook.set(lead.position.x, lead.position.y - 2, lead.position.z);
    wingLook.set(0, 2 + climb * 0.7, -back * 0.5);
    look.copy(coverLook).lerp(wingLook, k);
    camera.position.set(look.x + Math.sin(ang) * R, look.y + 8 + 12 * (1 - k), look.z + Math.cos(ang) * R);
    camera.lookAt(look);

    burst.quaternion.copy(camera.quaternion);
    if (!still) burst.rotateZ(t * 0.04);
    renderer.render(scene, camera);
  }

  function resize() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return;
    // Toon shading is flat colour: a modest pixel ratio stays crisp and
    // keeps the frame cheap.
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w < h ? 46 : 34;
    camera.updateProjectionMatrix();
    // Wide screens: the words sit on the left, so the scene plays on the
    // right. Portrait: the words sit at the bottom, so it plays up top.
    const wide = w >= 900 && w > h * 1.1;
    const tall = w < h;
    if (wide) camera.setViewOffset(w, h, -w * 0.2, 0, w, h);
    else if (tall) camera.setViewOffset(w, h, 0, h * (w < 600 ? 0.2 : 0.1), w, h);
    else camera.clearViewOffset();
    const halfH = Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect);
    fitR = 80 / (tall ? 0.96 : 0.85) / Math.tan(halfH) / (wide ? 0.62 : 1);
  }

  let visible = false;
  let raf = 0;
  let ready = false; // shaders compiled: until then nothing renders, so nothing stalls
  const motion = () => !reduced.matches;
  function running() { return ready && visible && !document.hidden && motion(); }
  function frame(time) {
    raf = 0;
    draw(time);
    if (running()) raf = requestAnimationFrame(frame);
  }
  function sync() {
    const run = running();
    section.toggleAttribute('data-running', run);
    window.dispatchEvent(new Event('swarm:state'));
    if (run && !raf) raf = requestAnimationFrame(frame);
    if (!run) {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      if (!motion() && ready) { progress = 1; draw(0); }
    }
  }

  new IntersectionObserver((entries) => { visible = entries[entries.length - 1].isIntersecting; sync(); }).observe(section);
  document.addEventListener('visibilitychange', sync);
  reduced.addEventListener('change', sync);
  new ResizeObserver(() => { resize(); if (!raf && ready) draw(performance.now()); }).observe(canvas);
  window.addEventListener('prologue:progress', (ev) => { progress = ev.detail; if (!raf && ready) draw(performance.now()); });
  if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
    window.addEventListener('pointermove', (ev) => { pointerTo = ev.clientX / window.innerWidth - 0.5; }, { passive: true });
  }
  resize();
  // Compile the shaders off the critical path where the browser can, then
  // fade the scene in and tell the page the opening is ready.
  const start = () => {
    ready = true;
    draw(performance.now());
    canvas.classList.add('ready');
    sync();
    window.dispatchEvent(new Event('opening:ready'));
  };
  if (renderer.compileAsync) renderer.compileAsync(scene, camera).then(start, start);
  else start();
}

/* ── Start ─────────────────────────────────────────────────────────── */

function webgl() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

if (webgl()) {
  const section = document.querySelector('[data-prologue]');
  if (section) {
    try {
      prologue(section);
    } catch (err) {
      section.classList.remove('has-3d');
      console.warn('ICARUS showcase: prologue scene unavailable.', err);
    }
  }
  // The cast is baked once the opening is up and the page has a quiet
  // moment (or after a short wait at the latest): it is all further down.
  const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 200));
  let started = false;
  const bakeCast = () => {
    if (started) return;
    started = true;
    idle(() => cast().catch((err) => console.warn('ICARUS showcase: 3D cast unavailable, keeping the flat one.', err)), { timeout: 1200 });
  };
  window.addEventListener('opening:ready', bakeCast, { once: true });
  setTimeout(bakeCast, 2500);
}
