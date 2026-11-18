/* ICARUS showcase: the swarm in toon-shaded 3D (Three.js r180, vendored).

   1. The cast. Each cursor is the page's arrow, extruded and bevelled, lit
      with cel shading (three flat bands), an ink outline and a face painted
      on its front: neutral, happy, shock, nervous, stern, sparkle, cry,
      sleepy, cool, and a blink frame. Every colour and expression the page
      uses is rendered once into an image, a few at a time so loading never
      stalls, which makes every character a crisp 3D asset that costs
      nothing per frame.
   2. The prologue. A live scene at the app's real limit, the lead and 24
      agents: a flock in three layers flying the lead's way, under a comic
      sun with a face and paper clouds, that folds into a pair of feathered
      wings as you scroll. Every arrow faces the reader and keeps an even ink
      line, and on the way to the wings no two ever pass through each other.
      It renders only while on screen and the tab is visible, caps the pixel
      ratio, and marks itself running so the glass nav steps aside: nothing
      moves behind glass. With reduced motion it draws one still frame.

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

function arrowGeometry(segments, grow = 0, size = 0.4) {
  const shape = new THREE.Shape();
  ARROW.forEach(([x, y], i) => (i ? shape.lineTo(x - 5, 3.2 - y) : shape.moveTo(x - 5, 3.2 - y)));
  shape.closePath();
  // Tip at the origin, the front cap facing +z. grow > 0 makes the shell
  // used for the ink outline.
  return new THREE.ExtrudeGeometry(shape, {
    depth: DEPTH, bevelEnabled: true,
    bevelThickness: BEVEL + grow * 0.7, bevelSize: size + grow,
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
/* ── The opening: ink, clouds and the sun's rays ───────────────────── */

// An even ink line: a back-face shell pushed out along smoothed normals by a
// constant amount, so it never thins or thickens as the shape turns (a grown
// copy of the shape does).
function inkGeometry(source) {
  const g = source.index ? source.toNonIndexed() : source.clone();
  if (g.attributes.uv) g.deleteAttribute('uv');
  const pos = g.attributes.position;
  const key = (i) => `${Math.round(pos.getX(i) * 1000)},${Math.round(pos.getY(i) * 1000)},${Math.round(pos.getZ(i) * 1000)}`;
  const sums = new Map();
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  for (let i = 0; i < pos.count; i += 3) {
    a.fromBufferAttribute(pos, i);
    b.fromBufferAttribute(pos, i + 1).sub(a);
    c.fromBufferAttribute(pos, i + 2).sub(a);
    const n = b.cross(c); // weighted by the triangle's area
    for (let j = 0; j < 3; j += 1) {
      const kk = key(i + j);
      const sum = sums.get(kk);
      if (sum) sum.add(n);
      else sums.set(kk, n.clone());
    }
  }
  const normals = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i += 1) {
    const n = sums.get(key(i)).clone().normalize();
    normals[i * 3] = n.x;
    normals[i * 3 + 1] = n.y;
    normals[i * 3 + 2] = n.z;
  }
  g.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  return g;
}

function inkMaterial(width) {
  const m = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.inkWidth = { value: width };
    shader.vertexShader = `uniform float inkWidth;\n${shader.vertexShader.replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\n\ttransformed += normalize( normal ) * inkWidth;',
    )}`;
  };
  return m;
}

// A paper-cut cloud: bumps (x, y, r) on a flat base, cut out and puffed.
function cloudGeometry(bumps) {
  const left = Math.min(...bumps.map(([x, , r]) => x - r));
  const right = Math.max(...bumps.map(([x, , r]) => x + r));
  const top = (x) => bumps.reduce((y, [cx, cy, r]) => {
    const dx = x - cx;
    return Math.abs(dx) < r ? Math.max(y, cy + Math.sqrt(r * r - dx * dx)) : y;
  }, 0);
  const shape = new THREE.Shape();
  shape.moveTo(left, 0);
  const steps = 64;
  for (let i = 1; i < steps; i += 1) {
    const x = left + ((right - left) * i) / steps;
    shape.lineTo(x, top(x));
  }
  shape.lineTo(right, 0);
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: 2.4, bevelEnabled: true, bevelThickness: 0.9, bevelSize: 0.7, bevelSegments: 2, curveSegments: 1,
  });
  g.center();
  return g;
}

// A comic twinkle: a four-pointed star with curved sides.
function twinkleGeometry() {
  const shape = new THREE.Shape();
  const steps = 48;
  for (let j = 0; j <= steps; j += 1) {
    const a = (j / steps) * Math.PI * 2;
    const r = 0.55 + 2.45 * Math.pow(Math.abs(Math.cos(a * 2)), 6);
    if (j === 0) shape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else shape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: 0.5, bevelEnabled: true, bevelThickness: 0.2, bevelSize: 0.12, bevelSegments: 1, curveSegments: 1,
  });
  g.translate(0, 0, -0.25);
  return g;
}

/* ── The opening ───────────────────────────────────────────────────── */

// The flock on the cover, in units at the lead's depth on screen (x right,
// y up, the lead's centre at 0, 0): 5 near, 8 mid, 11 far, all flying the
// lead's way. Laid out in 2D so each arrow clears the lead, the sun, the
// words and its neighbours; the far ones may run off the panel's edge.
const FLOCK = {
  wide: [[-8.3, -19.5], [2.6, -27.0], [15.2, -22.8], [19.0, -10.1], [19.0, 3.1], [-18.5, -25.9], [-8.6, -31.6], [2.7, -39.1], [12.6, -34.6], [26.1, -27.9], [28.7, -17.4], [30.5, -6.4], [31.1, 4.5], [-19.5, -35.7], [-13.0, -41.6], [-5.0, -45.2], [8.9, -46.8], [17.0, -43.4], [23.3, -37.3], [35.8, -26.1], [38.5, -17.8], [39.9, -9.1], [40.5, 1.7], [38.5, 11.0]],
  tall: [[20.4, -3.3], [15.5, 9.4], [-3.4, 25.2], [-20.5, 18.1], [-21.6, 0.5], [32.5, 0.1], [27.3, 13.4], [9.4, 20.3], [7.1, 31.6], [-13.2, 32.8], [-24.4, 30.0], [-31.0, 11.2], [-34.1, 0.2], [41.5, -5.4], [39.1, 8.2], [36.0, 19.3], [12.5, 41.1], [2.8, 41.1], [-6.7, 41.1], [-19.7, 41.1], [-33.0, 36.0], [-33.4, 22.4], [-41.1, 8.5], [-42.1, -6.7]],
};
// Depth behind the lead and size for each layer: the farther, the smaller.
const LAYERS = [{ n: 5, d: 8, s: 0.66 }, { n: 8, d: 26, s: 0.575 }, { n: 11, d: 46, s: 0.485 }];
// The sun: high in the corner on the cover, its rays running off the panel
// (x, y, depth behind the lead, size); then behind Icarus once the wings are
// out, growing as he climbs. The page's comic rays fan out from it.
const SUN_AT = { wide: [27, 21, 110, 1.9], tall: [22, 30, 110, 1.4] };
const SUN_WING = { wide: [0, 64, 200, 2.0], tall: [0, 62, 200, 1.7] };
// Clouds: x, y, depth, size, shape. They sit behind the flock, one just in
// front of the sun.
const CLOUD_SHAPES = [
  [[-9, 3, 5], [-2, 6, 7.5], [6.5, 4, 6], [12, 2, 4]],
  [[-6, 2.5, 4.5], [0.5, 5, 6.5], [7, 3, 5]],
  [[-7, 2, 4], [-1, 4.5, 5.5], [5, 3.5, 5], [10, 1.8, 3.6]],
];
const CLOUDS = {
  wide: [[18, 11, 70, 0.85, 1], [-10, 28, 70, 0.75, 2], [36, -22, 66, 0.8, 0]],
  tall: [[14, 21, 70, 0.7, 1], [-30, 34, 70, 0.6, 2], [-38, -10, 60, 0.6, 0], [38, -14, 40, 0.55, 2]],
};
// Wings: per side 5 inner and 7 outer feathers fanned from the shoulder,
// as angles on the left (degrees, 90 up, 180 out); the roster takes the top
// (leading) feather of each ring. An arrow is 14 units across its heading,
// so each ring's spacing (radius x angle) leaves a small gap between them.
const INNER = [105, 128.5, 152, 175.5, 199];
const OUTER = [100, 115, 130, 145, 160, 175, 190];
const SLOTS = [['i', 0], ['o', 0], ['i', 1], ['o', 1], ['i', 2], ['o', 2], ['i', 3], ['o', 3], ['i', 4], ['o', 4], ['o', 5], ['o', 6]];
const TIP = 126.4; // the arrow's own heading in its plane, degrees

function prologue(section) {
  // Size the stage first: the canvas measures it.
  section.classList.add('has-3d');
  const canvas = section.querySelector('canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  toonLights(scene);
  const camera = new THREE.PerspectiveCamera(34, 1, 1, 1400);
  const aim = new THREE.PerspectiveCamera(); // the camera's base framing, for the page's rays
  const sunScreen = new THREE.Vector3();
  const pin = canvas.parentElement;
  let sunX = -1;
  let sunY = -1;
  const ramp = rampTexture();
  const UP = new THREE.Vector3(0, 1, 0);
  const D2R = Math.PI / 180;

  // Seeded randomness: the same flock on every visit.
  let seed = 7;
  const rand = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

  // The flock: one instanced body and one ink shell sharing matrices.
  const N = 24; // the most agents the app runs at once
  // A slim bevel: a wide one spikes out at the arrowhead's sharp corners.
  const geo = arrowGeometry(3, 0, 0.16);
  geo.translate(-6.75, 9.15, -(DEPTH / 2)); // turn about the middle
  const mesh = new THREE.InstancedMesh(geo, new THREE.MeshToonMaterial({ color: '#ffffff', gradientMap: ramp }), N);
  const ink = new THREE.InstancedMesh(inkGeometry(geo), inkMaterial(0.85), N);
  ink.instanceMatrix = mesh.instanceMatrix;
  mesh.frustumCulled = false; // they fly well past where they started
  ink.frustumCulled = false;
  const color = new THREE.Color();
  scene.add(ink, mesh);

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
    new THREE.Mesh(leadShell, new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide })),
  );
  lead.scale.setScalar(1.7);
  scene.add(lead);

  // The sun, one of the cast: a lemon-gold ball with a bold ink rim, an
  // inker's shine and a content face, ringed by sculpted toon rays, with a
  // few twinkles. It faces the camera, as a sun in a comic does.
  const SUN_R = 10.5;
  const sun = new THREE.Group();
  const flat = (hex) => new THREE.MeshToonMaterial({ color: hex, gradientMap: ramp });
  const inked = (geom, mat, width, z, parent = sun) => {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(inkGeometry(geom), inkMaterial(width)), new THREE.Mesh(geom, mat));
    g.position.z = z;
    parent.add(g);
    return g;
  };
  // Twelve rays, long and short, each a real cone so it takes the light.
  const rays = new THREE.Group();
  sun.add(rays);
  const zAxis = new THREE.Vector3(0, 0, 1);
  for (let i = 0; i < 12; i += 1) {
    const long = i % 2 === 0;
    const h = long ? 9.5 : 6.2;
    const a = (i / 12) * Math.PI * 2;
    const g = inked(new THREE.ConeGeometry(long ? 2.5 : 2.1, h, 24, 1), flat(long ? '#ffc23d' : '#ff9a3d'), 0.45, -1.2, rays);
    g.position.set(Math.cos(a) * (SUN_R * 1.08 + h / 2), Math.sin(a) * (SUN_R * 1.08 + h / 2), -1.2);
    g.quaternion.setFromAxisAngle(zAxis, a - Math.PI / 2);
  }
  const ball = new THREE.SphereGeometry(SUN_R, 48, 32);
  sun.add(
    new THREE.Mesh(ball, inkMaterial(1.0)),
    new THREE.Mesh(ball, new THREE.MeshToonMaterial({ color: '#ffd23f', gradientMap: ramp, emissive: new THREE.Color('#ff9a1f'), emissiveIntensity: 0.3 })),
  );
  // The shine: a crisp white stroke and a dot on the upper left.
  const white = new THREE.MeshBasicMaterial({ color: '#fffbea' });
  const shine = new THREE.Mesh(new THREE.TorusGeometry(SUN_R * 0.66, 0.62, 8, 28, 1.0), white);
  shine.position.z = SUN_R * 0.78;
  shine.rotation.z = 1.95;
  const dot = new THREE.Mesh(new THREE.CircleGeometry(0.85, 20), white);
  dot.position.set(-SUN_R * 0.62, SUN_R * 0.08, SUN_R * 0.8);
  sun.add(shine, dot);
  {
    // The face: content, eyes closed, a small smile and blush, like the cast.
    const fc = document.createElement('canvas');
    fc.width = fc.height = 256;
    const g = fc.getContext('2d');
    g.lineCap = 'round';
    g.strokeStyle = INK;
    g.lineWidth = 11;
    for (const x of [92, 164]) { g.beginPath(); g.arc(x, 118, 19, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); }
    g.beginPath(); g.arc(128, 142, 26, Math.PI * 0.18, Math.PI * 0.82); g.stroke();
    g.fillStyle = 'rgba(255, 95, 120, 0.55)';
    for (const x of [70, 186]) { g.beginPath(); g.ellipse(x, 150, 18, 10, 0, 0, Math.PI * 2); g.fill(); }
    const tex = new THREE.CanvasTexture(fc);
    tex.colorSpace = THREE.SRGBColorSpace;
    const sunFace = new THREE.Mesh(new THREE.CircleGeometry(SUN_R * 0.9, 48), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
    sunFace.position.z = SUN_R * 1.002;
    sun.add(sunFace);
  }
  const twinkle = twinkleGeometry();
  const twinkles = [[38, 2.25, 1], [152, 2.35, 0.75], [232, 2.25, 0.9], [318, 2.4, 0.65]].map(([deg, r, size], n) => {
    const g = inked(twinkle, new THREE.MeshBasicMaterial({ color: '#fffbea' }), 0.35, 0.5);
    g.position.set(Math.cos(deg * D2R) * SUN_R * r, Math.sin(deg * D2R) * SUN_R * r, 0.5);
    g.userData = { size, phase: n * 1.7 };
    return g;
  });
  scene.add(sun);

  // Clouds: paper cut-outs, ink edged, coloured for Night or Day.
  const cloudMat = new THREE.MeshToonMaterial({ color: '#55499e', gradientMap: ramp });
  const cloudInk = inkMaterial(0.55);
  const cloudGeos = CLOUD_SHAPES.map((b) => { const g = cloudGeometry(b); return [g, inkGeometry(g)]; });
  const clouds = [0, 1, 2, 3].map(() => {
    const c = new THREE.Group();
    c.add(new THREE.Mesh(cloudGeos[0][1], cloudInk), new THREE.Mesh(cloudGeos[0][0], cloudMat));
    scene.add(c);
    return c;
  });
  const paintClouds = () => cloudMat.color.set(root.dataset.theme === 'light' ? '#ffffff' : '#55499e');
  paintClouds();

  // Wings: the feather slots, relative to the lead. Slots 0-3 are the
  // leading edge, where the roster flies; each slot keeps its agent's colour.
  const wingSide = [];
  const wingAng = [];
  const wingR = [];
  const wingZ = [];
  const wingS = [];
  const slotOf = []; // which slot each arrow on the cover flies to
  for (let i = 0; i < N; i += 1) {
    const side = i % 2 === 0 ? -1 : 1;
    const j = Math.floor(i / 2);
    const [ring, n] = SLOTS[j];
    wingSide.push(side);
    wingAng.push((ring === 'i' ? INNER : OUTER)[n]);
    wingR.push(ring === 'i' ? 28 : 50);
    wingZ.push((ring === 'i' ? -4 : -9) - n * 0.5);
    wingS.push(ring === 'i' ? 0.8 : 0.92);
  }

  // The cover: each agent's place and pose, the clouds and the sun, laid out
  // for the camera's first framing. Redone only when that framing changes.
  const lead0 = new THREE.Vector3(0, 6, 6);
  const cover = Array.from({ length: N }, () => new THREE.Vector3());
  const coverQ = Array.from({ length: N }, () => new THREE.Quaternion());
  const scaleOf = [];
  const phase = [];
  const flight = new THREE.Vector3();
  const sunCover = new THREE.Vector3();
  const sunWing = new THREE.Vector3();
  let sunSize = 1;
  let sunWingSize = 1;
  const cloudAt = [];
  const cloudR = [];
  const m4 = new THREE.Matrix4();
  const e = new THREE.Euler();
  const qj = new THREE.Quaternion();

  function viewFrom(k) {
    // The camera where draw() puts it at the start (k = 0) or with the wings
    // formed (k = 1), before the pointer and the slow sway.
    const ang = 0.46 * (1 - k) - 0.05;
    const R = fitR * (near + (1 - near) * k);
    const look = k ? new THREE.Vector3(0, 2, 0) : new THREE.Vector3(lead0.x, lead0.y - 2, lead0.z);
    const eye = new THREE.Vector3(look.x + Math.sin(ang) * R, look.y + 8 + 12 * (1 - k), look.z + Math.cos(ang) * R);
    const f = look.clone().sub(eye).normalize();
    const r = new THREE.Vector3().crossVectors(f, UP).normalize();
    return { eye, f, r, u: new THREE.Vector3().crossVectors(r, f) };
  }
  // The point that shows (x, y) units from the lead on screen, d units behind it.
  function place(v, x, y, d, out) {
    const D = lead0.clone().sub(v.eye).dot(v.f);
    const g = (D + d) / D;
    return out.copy(lead0).addScaledVector(v.r, x * g).addScaledVector(v.u, y * g).addScaledVector(v.f, d);
  }
  function facing(at, eye, out) {
    return out.setFromRotationMatrix(m4.lookAt(eye, at, UP)); // front cap to the camera
  }

  // On the way to the wings each arrow turns to its feather's heading, so
  // neighbours would swing into each other. Each arrow takes the first depth
  // lane in which its whole trip, as draw() flies it, stays clear of every
  // arrow already placed: apart on screen, or apart in depth. The cover
  // needs no lanes, so this runs in an idle moment after the layout (or at
  // once, if the reader scrolls first).
  let ends = [];
  let lanesReady = false;
  const lane = new Array(N).fill(0);
  function solveLanes() {
    const size = (a, kk) => scaleOf[a] + (wingS[slotOf[a]] - scaleOf[a]) * kk;
    const trip = (a, l, kk, out) => {
      const lift = Math.sin(Math.PI * kk);
      out.copy(cover[a]).lerp(ends[slotOf[a]], kk);
      out.y += lift * 8;
      out.z -= lift * (5 + l * 9);
      return out;
    };
    // The arrow's outline, centred like its geometry, as it is at a point of
    // the trip: its turn, its size and its depth range, all as draw() has them.
    const outline = ARROW.map(([x, y]) => [x - 5 - 6.75, 3.2 - y + 9.15]);
    const tq = new THREE.Quaternion();
    const tw = new THREE.Quaternion();
    const ax = new THREE.Vector3();
    const ay = new THREE.Vector3();
    const az = new THREE.Vector3();
    const cache = new Map();
    const shapeAt = (a, l, step) => {
      const key = a * 4096 + l * 32 + step;
      const hit = cache.get(key);
      if (hit) return hit;
      const kk = (step + 1) * 0.06;
      const sl = slotOf[a];
      const g = wingSide[sl] < 0 ? wingAng[sl] : 180 - wingAng[sl];
      tq.copy(coverQ[a]).slerp(tw.setFromEuler(e.set(0.08, 0, (g - TIP) * D2R)), kk);
      ax.set(1, 0, 0).applyQuaternion(tq);
      ay.set(0, 1, 0).applyQuaternion(tq);
      az.set(0, 0, 1).applyQuaternion(tq);
      const c = trip(a, l, kk, new THREE.Vector3());
      const sc = size(a, kk);
      const pts = outline.map(([x, y]) => [c.x + sc * (x * ax.x + y * ay.x), c.y + sc * (x * ax.y + y * ay.y), c.z + sc * (x * ax.z + y * ay.z)]);
      const half = sc * 1.15 * Math.abs(az.z) + 0.6;
      const xs = pts.map((v) => v[0]);
      const ys = pts.map((v) => v[1]);
      const shape = {
        pts, gap: 1.2 * sc, c: c.clone(), r: 12 * sc, kk,
        lo: Math.min(...pts.map((v) => v[2])) - half, hi: Math.max(...pts.map((v) => v[2])) + half,
        x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys),
      };
      cache.set(key, shape);
      return shape;
    };
    const inPoly = (x, y, pts) => {
      let c = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i];
        const [xj, yj] = pts[j];
        if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
      }
      return c;
    };
    const segGap = (p1, p2, p3, p4) => {
      // the distance between two segments in the screen plane (0 if they cross)
      const d = (px, py, ax1, ay1, bx, by) => {
        const vx = bx - ax1;
        const vy = by - ay1;
        const t = Math.max(0, Math.min(1, ((px - ax1) * vx + (py - ay1) * vy) / (vx * vx + vy * vy || 1)));
        return Math.hypot(px - ax1 - t * vx, py - ay1 - t * vy);
      };
      const cross = (o, q1, r) => (q1[0] - o[0]) * (r[1] - o[1]) - (q1[1] - o[1]) * (r[0] - o[0]);
      if (cross(p1, p2, p3) * cross(p1, p2, p4) < 0 && cross(p3, p4, p1) * cross(p3, p4, p2) < 0) return 0;
      return Math.min(d(p1[0], p1[1], p3[0], p3[1], p4[0], p4[1]), d(p2[0], p2[1], p3[0], p3[1], p4[0], p4[1]),
        d(p3[0], p3[1], p1[0], p1[1], p2[0], p2[1]), d(p4[0], p4[1], p1[0], p1[1], p2[0], p2[1]));
    };
    const touch = (A, B) => {
      if (A.hi < B.lo || B.hi < A.lo) return false; // apart in depth
      const gap0 = A.gap + B.gap;
      if (A.x1 + gap0 < B.x0 || B.x1 + gap0 < A.x0 || A.y1 + gap0 < B.y0 || B.y1 + gap0 < A.y0) return false; // apart on screen
      if (A.pts.some(([x, y]) => inPoly(x, y, B.pts)) || B.pts.some(([x, y]) => inPoly(x, y, A.pts))) return true;
      const gap = A.gap + B.gap;
      for (let i = 0, j = A.pts.length - 1; i < A.pts.length; j = i++) {
        for (let m = 0, n = B.pts.length - 1; m < B.pts.length; n = m++) {
          if (segGap(A.pts[j], A.pts[i], B.pts[n], B.pts[m]) < gap) return true;
        }
      }
      return false;
    };
    const clear = (a, l, b) => {
      for (let step = 0; step < 16; step += 1) { // the trip from 6% to 96%: the cover and the wings are clear by layout
        if (touch(shapeAt(a, l, step), shapeAt(b, lane[b], step))) return false;
      }
      return true;
    };
    // The sun and the clouds are in the way too: no trip may pass through them.
    const sunAt = new THREE.Vector3();
    const blocked = (a, l) => {
      for (let step = 0; step < 16; step += 1) {
        const A = shapeAt(a, l, step);
        const size = sunSize + (sunWingSize - sunSize) * A.kk;
        sunAt.copy(sunCover).lerp(sunWing, A.kk);
        if (A.c.distanceTo(sunAt) < (SUN_R * 1.08 + 10.5) * size + A.r) return true;
        for (let n = 0; n < cloudAt.length; n += 1) {
          const cl = cloudAt[n];
          const dy = cl.y - A.kk * 4 - A.c.y;
          if (Math.hypot(cl.x - A.c.x, dy, cl.z - A.c.z) < cloudR[n] + A.r) return true;
        }
      }
      return false;
    };
    const placed = [];
    for (let a = 0; a < N; a += 1) {
      let best = 0;
      let fewest = Infinity;
      for (let l = 0; l <= 12; l += 1) {
        const hits = (blocked(a, l) ? 1 : 0) + placed.filter((b) => !clear(a, l, b)).length;
        if (hits < fewest) { fewest = hits; best = l; }
        if (!hits) break;
      }
      lane[a] = best;
      placed.push(a);
    }
    lanesReady = true;
  }
  function scheduleLanes() {
    lanesReady = false;
    lane.fill(0);
    const later = window.requestIdleCallback || ((fn) => setTimeout(fn, 300));
    later(() => { if (!lanesReady) solveLanes(); }, { timeout: 2000 });
  }

  let framing = '';
  let framedR = 0;
  function layout(kind) {
    framing = kind;
    framedR = fitR;
    seed = 7;
    const v0 = viewFrom(0);
    const v1 = viewFrom(1);
    const pts = FLOCK[kind];
    let i = 0;
    for (const L of LAYERS) {
      for (let j = 0; j < L.n; j += 1, i += 1) {
        const [x, y] = pts[i];
        place(v0, x, y, L.d, cover[i]);
        // Facing the reader, pointing the lead's way, with a gentle tilt:
        // never more than 25 degrees of turn, 15 of pitch.
        facing(cover[i], v0.eye, coverQ[i]);
        e.set((rand() - 0.5) * 30 * D2R, (rand() - 0.5) * 50 * D2R, (0.1 + (rand() - 0.5) * 0.24));
        coverQ[i].multiply(qj.setFromEuler(e));
        scaleOf[i] = L.s;
        phase[i] = x * 0.09 + y * 0.05;
      }
    }
    // Who flies to which feather: the pairing with the shortest total path.
    // Shortest pairings never cross, so no two arrows meet on the way.
    const slotAt = (sl, out) => {
      const a = wingAng[sl];
      const g = wingSide[sl] < 0 ? a : 180 - a;
      return out.set(wingSide[sl] * 6 + Math.cos(g * D2R) * wingR[sl], 3 + Math.sin(g * D2R) * wingR[sl], wingZ[sl]).add(lead0);
    };
    ends = Array.from({ length: N }, (_, sl) => slotAt(sl, new THREE.Vector3()));
    const len = (a, sl) => Math.hypot(cover[a].x - ends[sl].x, cover[a].y - ends[sl].y);
    for (let a = 0; a < N; a += 1) slotOf[a] = a;
    for (let pass = 0, changed = true; changed && pass < 60; pass += 1) {
      changed = false;
      for (let a = 0; a < N; a += 1) {
        for (let b = a + 1; b < N; b += 1) {
          if (len(a, slotOf[b]) + len(b, slotOf[a]) < len(a, slotOf[a]) + len(b, slotOf[b]) - 1e-6) {
            [slotOf[a], slotOf[b]] = [slotOf[b], slotOf[a]];
            changed = true;
          }
        }
      }
    }
    for (let a = 0; a < N; a += 1) {
      const sl = slotOf[a];
      mesh.setColorAt(a, color.set(sl < 4 ? FIXED[sl] : agentColor(sl + 2)));
    }
    mesh.instanceColor.needsUpdate = true;
    scheduleLanes();
    flight.copy(v0.r).multiplyScalar(-0.59).addScaledVector(v0.u, 0.81); // the lead's heading
    const [sx, sy, sd, ss] = SUN_AT[kind];
    place(v0, sx, sy, sd, sunCover);
    const [wx, wy, wd, ws] = SUN_WING[kind];
    place(v1, wx, wy, wd, sunWing);
    sunSize = ss;
    sunWingSize = ws;
    cloudAt.length = 0;
    clouds.forEach((c, n) => { c.visible = n < CLOUDS[kind].length; });
    CLOUDS[kind].forEach(([x, y, d, s, shape], n) => {
      const c = clouds[n];
      const [body, edge] = cloudGeos[shape];
      c.children[0].geometry = edge;
      c.children[1].geometry = body;
      place(v0, x, y, d, c.position);
      facing(c.position, v0.eye, c.quaternion);
      c.scale.setScalar(s);
      cloudAt.push(c.position.clone());
      body.computeBoundingSphere();
      cloudR[n] = body.boundingSphere.radius * s;
    });
  }

  const p = new THREE.Vector3();
  const w = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const wq = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const look = new THREE.Vector3();
  const coverLook = new THREE.Vector3();
  const wingLook = new THREE.Vector3();
  const leadCoverQ = new THREE.Quaternion().setFromEuler(e.set(-0.16, 0.34, 0.1)); // three-quarters to the reader
  const leadWingQ = new THREE.Quaternion().setFromEuler(e.set(0.1, 0, 0.12));
  const ease = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : (1 - (1 + 7 * t) * Math.exp(-7 * t)) / (1 - 8 * Math.exp(-7)));
  const smooth = (t) => t * t * (3 - 2 * t);
  const clamp = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

  let progress = parseFloat(section.dataset.p || '0') || 0;
  let fitR = 160;
  let near = 0.42; // how close the cover starts, as a share of the wings' distance
  let pointer = 0;
  let pointerTo = 0;

  function draw(time) {
    const still = reduced.matches;
    const t = still ? 0 : time / 1000;
    const k = ease(clamp((progress - 0.2) / 0.5)); // the flock forms its wings
    if (k > 0 && !lanesReady) solveLanes();
    const up = smooth(clamp((progress - 0.72) / 0.28)); // then Icarus climbs toward the sun
    const climb = up * 12;
    const back = up * 10;

    const bob = still ? 0 : Math.sin(t * 1.3) * 0.9 * (1 - k * 0.5);
    lead.position.set(lead0.x, lead0.y + bob + climb, lead0.z - back);
    lead.quaternion.copy(leadCoverQ).slerp(leadWingQ, k);
    if (!still) lead.rotateZ(Math.sin(t * 0.9) * 0.035);

    const flap = still ? 0 : Math.sin(t * 1.7) * 6 * k; // degrees, both wings up together
    for (let i = 0; i < N; i += 1) {
      const sl = slotOf[i];
      const ki = k;
      const lift = Math.sin(Math.PI * ki);
      const idle = still ? 0 : 1 - ki;
      // Cover: bob, a small surge along the heading, a little sway; no spin.
      const ph = phase[i];
      p.copy(cover[i]);
      if (idle) {
        p.y += Math.sin(t * 1.15 + ph) * 1.1 * idle;
        p.addScaledVector(flight, Math.sin(t * 0.55 + ph) * 0.8 * idle);
      }
      q.copy(coverQ[i]);
      if (idle) q.multiply(qj.setFromEuler(e.set(0, Math.sin(t * 0.65 + ph * 1.3) * 0.07 * idle, Math.sin(t * 0.9 + ph) * 0.06 * idle)));
      // Wings: a feather fanned from the shoulder, flapping gently.
      const side = wingSide[sl];
      const ang = side < 0 ? wingAng[sl] - flap : 180 - wingAng[sl] + flap;
      w.set(side * 6 + Math.cos(ang * D2R) * wingR[sl], 3 + Math.sin(ang * D2R) * wingR[sl], wingZ[sl]).add(lead.position);
      wq.setFromEuler(e.set(0.08, 0, (ang - TIP) * D2R));
      // On the way, they swoop up and pass behind the lead, each in its lane.
      p.lerp(w, ki);
      p.y += lift * 8;
      p.z -= lift * (5 + lane[i] * 9);
      q.slerp(wq, ki);
      const sc = scaleOf[i] + (wingS[sl] - scaleOf[i]) * ki;
      mesh.setMatrixAt(i, m4.compose(p, q, s.set(sc, sc, sc)));
    }
    mesh.instanceMatrix.needsUpdate = true;

    clouds.forEach((c, n) => {
      const a = cloudAt[n];
      if (!a) return;
      c.position.set(a.x + (still ? 0 : Math.sin(t * 0.08 + n * 2.1) * 1.6), a.y - up * 18 - k * 4, a.z);
    });

    pointer += (pointerTo - pointer) * 0.06;
    const turn = 0.46 * (1 - k) - 0.05 + pointer * 0.1 + (still ? 0 : Math.sin(t * 0.15) * 0.03);
    const R = fitR * (near + (1 - near) * k + 0.06 * up);
    coverLook.set(lead.position.x, lead.position.y - 2, lead.position.z);
    wingLook.set(0, 2 + climb * 0.7, -back * 0.5);
    look.copy(coverLook).lerp(wingLook, k);
    camera.position.set(look.x + Math.sin(turn) * R, look.y + 8 + 12 * (1 - k), look.z + Math.cos(turn) * R);
    camera.lookAt(look);

    // The sun faces the reader, turns slowly, and grows as Icarus nears it.
    sun.position.copy(sunCover).lerp(sunWing, k);
    aim.position.set(look.x + Math.sin(0.46 * (1 - k) - 0.05) * R, look.y + 8 + 12 * (1 - k), look.z + Math.cos(0.46 * (1 - k) - 0.05) * R);
    aim.lookAt(look);
    aim.updateMatrixWorld();
    const sp = sunScreen.copy(sun.position).project(aim);
    const sx = Math.round((sp.x + 1) * 250) / 5;
    const sy = Math.round((1 - sp.y) * 250) / 5;
    if (sx !== sunX || sy !== sunY) {
      sunX = sx;
      sunY = sy;
      pin.style.setProperty('--sun-x', `${sx}%`);
      pin.style.setProperty('--sun-y', `${sy}%`);
    }
    sun.quaternion.copy(camera.quaternion);
    sun.scale.setScalar((sunSize + (sunWingSize - sunSize) * k) * (1 + 0.1 * up));
    rays.rotation.z = still ? 0 : t * 0.045;
    for (const tw of twinkles) {
      const { size, phase: ph } = tw.userData;
      tw.scale.setScalar(size * (still ? 1 : 0.72 + 0.28 * Math.sin(t * 1.6 + ph)));
      tw.rotation.z = still ? 0 : Math.sin(t * 0.5 + ph) * 0.15;
    }
    renderer.render(scene, camera);
  }

  function resize() {
    const cw = canvas.clientWidth;
    const ch = canvas.clientHeight;
    if (!cw || !ch) return;
    // Toon shading is flat colour: a modest pixel ratio stays crisp and
    // keeps the frame cheap.
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setSize(cw, ch, false);
    camera.aspect = cw / ch;
    camera.fov = cw < ch ? 46 : 34;
    camera.updateProjectionMatrix();
    aim.copy(camera);
    // Wide screens: the words sit on the left, so the scene plays on the
    // right. Portrait: the words sit at the bottom, so it plays up top.
    const wide = cw >= 900 && cw > ch * 1.1;
    const tall = cw < ch;
    if (wide) camera.setViewOffset(cw, ch, -cw * 0.2, 0, cw, ch);
    else if (tall) camera.setViewOffset(cw, ch, 0, ch * (cw < 600 ? 0.2 : 0.1), cw, ch);
    else camera.clearViewOffset();
    const halfH = Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect);
    fitR = 80 / (tall ? 0.96 : 0.85) / Math.tan(halfH) / (wide ? 0.62 : 1);
    near = tall ? 0.54 : 0.42; // a phone's cover leaves room for the words under it
    // Lay the cover out again only when the framing changes, not when a
    // phone's address bar comes and goes.
    const kind = tall ? 'tall' : 'wide';
    if (kind !== framing || Math.abs(fitR - framedR) > framedR * 0.15) layout(kind);
  }

  let visible = false;
  let raf = 0;
  let ready = false; // shaders compiled: until then nothing renders, so nothing stalls
  const motion = () => !reduced.matches;
  const redraw = () => { if (!raf && ready) draw(performance.now()); };
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
  new ResizeObserver(() => { resize(); redraw(); }).observe(canvas);
  new MutationObserver(() => { paintClouds(); redraw(); }).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
  window.addEventListener('prologue:progress', (ev) => { progress = ev.detail; redraw(); });
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
