// Choufha — scroll-driven 3D armchair for the home page story.
// Bundled with esbuild into static/assets/js/hero3d.js (see package.json "bundle").
import {
  WebGLRenderer, Scene, PerspectiveCamera, Group, Vector3, Box3, Color, PMREMGenerator,
  DirectionalLight, Mesh, PlaneGeometry, MeshBasicMaterial, CanvasTexture, RingGeometry,
  BufferGeometry, Line, LineBasicMaterial, LineSegments, Float32BufferAttribute, ShadowMaterial,
  ACESFilmicToneMapping, SRGBColorSpace, PCFSoftShadowMap, DoubleSide, MathUtils,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const story = document.getElementById('story');
const canvas = document.getElementById('c3d');
const box = story && story.querySelector('.story-canvas');
const tag = document.querySelector('script[data-model]');
if (story && canvas && tag) init();

function fire(n, d) { dispatchEvent(new CustomEvent(n, { detail: d })); }
function land() { document.documentElement.classList.add('landed'); }

function init() {
  let renderer;
  try {
    renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (e) { story.classList.add('no-webgl'); fire('c3d:fail'); land(); return; }

  const rtl = document.documentElement.dir === 'rtl';
  const side = rtl ? -1 : 1;                       // model sits opposite the text column
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mq = matchMedia('(max-width: 820px)');
  let mobile = mq.matches;

  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = !mobile;
  renderer.shadowMap.type = PCFSoftShadowMap;

  const scene = new Scene();
  const pm = new PMREMGenerator(renderer);
  scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.85;

  const camera = new PerspectiveCamera(28, 1, 0.1, 50);
  const target = new Vector3(0, 0.42, 0);
  camera.position.set(0, 1.05, 4.6);
  camera.lookAt(target);
  const dist = camera.position.distanceTo(target);

  const key = new DirectionalLight(0xffffff, 1.6);
  key.position.set(-2.2, 4, 2.6);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3, near: 0.5, far: 12 });
  key.shadow.radius = 6; key.shadow.bias = -0.0005;
  scene.add(key);
  const rim = new DirectionalLight(0xff6b6b, 0.9);   // faint red rim light, brand accent
  rim.position.set(2.5, 1.6, -3);
  scene.add(rim);

  // rig = position/scale on screen, pivot = rotation of the piece
  const rig = new Group(), pivot = new Group();
  rig.add(pivot); scene.add(rig);

  // soft contact shadow + real shadow catcher
  const blobTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d'), r = g.createRadialGradient(64, 64, 4, 64, 64, 64);
    r.addColorStop(0, 'rgba(0,0,0,.75)'); r.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = r; g.fillRect(0, 0, 128, 128);
    return new CanvasTexture(c);
  })();
  const blob = new Mesh(new PlaneGeometry(1.5, 1.5), new MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false }));
  blob.rotation.x = -Math.PI / 2; blob.position.y = 0.002;
  pivot.add(blob);
  const catcher = new Mesh(new PlaneGeometry(6, 6), new ShadowMaterial({ opacity: 0.32 }));
  catcher.rotation.x = -Math.PI / 2; catcher.receiveShadow = true;
  rig.add(catcher);

  // AR floor rings
  const ringMat = new MeshBasicMaterial({ color: 0xe2525a, transparent: true, opacity: 0, side: DoubleSide, depthWrite: false });
  const ring = new Mesh(new RingGeometry(0.72, 0.735, 128), ringMat);
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.004; rig.add(ring);
  const ring2Mat = ringMat.clone();
  const ring2 = new Mesh(new RingGeometry(0.72, 0.728, 128), ring2Mat);
  ring2.rotation.x = -Math.PI / 2; ring2.position.y = 0.004; rig.add(ring2);

  // state
  const stages = [...story.querySelectorAll('.stage')];
  const labels = [...story.querySelectorAll('.dl')];
  const frame = story.querySelector('.arframe');
  const swatchBtns = [...story.querySelectorAll('.colorway button')];
  const COLORS = ['#eef0f8', '#55555c', '#b8121c', '#8f9c74'].map((c) => new Color(c));
  let PILLOW = null;
  let colorIdx = 0, userPicked = false, lastSwap = 0;
  let fabric = null, pillow = null, model = null, dims = null, dimMat = null, size = new Vector3();
  const anchors = [];
  let centers = [], vw = 1, vh = 1, running = false, visible = true;

  // keyframes: x/y = fraction of visible width/height from centre, h = fraction of visible height for the piece
  const DESK = [
    { x: .26, y: -.05, h: .47, ry: -.62, rx: .02 },
    { x: .25, y: -.03, h: .50, ry: -.28, rx: .06 },
    { x: .25, y: -.02, h: .55, ry: .78, rx: .0 },
    { x: .25, y: -.06, h: .38, ry: -.5, rx: .1 },
    { x: .25, y: -.03, h: .48, ry: -.6 - Math.PI * 2, rx: .02 },
  ];
  const MOB = [
    { x: 0, y: .25, h: .30, ry: -.62, rx: .02 },
    { x: 0, y: .21, h: .30, ry: -.28, rx: .08 },
    { x: 0, y: .21, h: .34, ry: .78, rx: .0 },
    { x: 0, y: .20, h: .26, ry: -.5, rx: .12 },
    { x: 0, y: .21, h: .30, ry: -.6 - Math.PI * 2, rx: .02 },
  ];
  const cur = { x: 0, y: 0, h: 0, ry: 0, rx: 0, dims: 0, ar: 0, mat: 0 };
  let primed = false, introAt = 0, landAt = 0;
  addEventListener('choufha:reveal', () => { introAt = performance.now(); });
  if (!document.getElementById('loader')) introAt = performance.now() + 300;
  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };

  function measure() {
    vw = box.clientWidth; vh = box.clientHeight;
    mobile = mq.matches;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, mobile ? 1.75 : 2));
    renderer.setSize(vw, vh, false);
    renderer.shadowMap.enabled = !mobile;
    camera.aspect = vw / vh;
    camera.fov = mobile ? 34 : 28;
    camera.updateProjectionMatrix();
    const sy = scrollY;
    centers = stages.map((s) => { const r = s.getBoundingClientRect(); return r.top + sy + r.height / 2; });
  }

  function progress() {
    const c = scrollY + innerHeight / 2;
    if (c <= centers[0]) return 0;
    for (let i = 0; i < centers.length - 1; i++) {
      if (c < centers[i + 1]) {
        const f = (c - centers[i]) / (centers[i + 1] - centers[i]);
        return i + MathUtils.smootherstep(f, 0.12, 0.88);
      }
    }
    return centers.length - 1;
  }

  const bump = (t, i) => Math.max(0, 1 - Math.abs(t - i) * 1.6);

  function targets(t) {
    const K = mobile ? MOB : DESK;
    const i = Math.min(Math.floor(t), K.length - 2), f = t - i, a = K[i], b = K[i + 1];
    const L = (k) => a[k] + (b[k] - a[k]) * f;
    return { x: L('x') * side, y: L('y'), h: L('h'), ry: L('ry') * (rtl ? 1 : -1), rx: L('rx'), dims: bump(t, 1), mat: bump(t, 2), ar: bump(t, 3) };
  }

  function buildDims() {
    const w = size.x, d = size.z, h = size.y, o = 0.09, tk = 0.035;
    const pts = [];
    const seg = (a, b) => pts.push(...a, ...b);
    // width — along the front
    seg([-w / 2, .01, d / 2 + o], [w / 2, .01, d / 2 + o]);
    seg([-w / 2, .01, d / 2 + o - tk], [-w / 2, .01, d / 2 + o + tk]);
    seg([w / 2, .01, d / 2 + o - tk], [w / 2, .01, d / 2 + o + tk]);
    // depth — along the side
    seg([w / 2 + o, .01, -d / 2], [w / 2 + o, .01, d / 2]);
    seg([w / 2 + o - tk, .01, -d / 2], [w / 2 + o + tk, .01, -d / 2]);
    seg([w / 2 + o - tk, .01, d / 2], [w / 2 + o + tk, .01, d / 2]);
    // height — back corner
    seg([-w / 2 - o, 0, -d / 2], [-w / 2 - o, h, -d / 2]);
    seg([-w / 2 - o - tk, 0, -d / 2], [-w / 2 - o + tk, 0, -d / 2]);
    seg([-w / 2 - o - tk, h, -d / 2], [-w / 2 - o + tk, h, -d / 2]);
    const g = new BufferGeometry(); g.setAttribute('position', new Float32BufferAttribute(pts, 3));
    dimMat = new LineBasicMaterial({ color: 0xe2525a, transparent: true, opacity: 0, depthTest: false });
    dims = new LineSegments(g, dimMat); dims.renderOrder = 5;
    pivot.add(dims);
    anchors.push(new Vector3(0, .01, d / 2 + o + .05), new Vector3(w / 2 + o + .05, .01, 0), new Vector3(-w / 2 - o - .05, h / 2, -d / 2));
  }

  const v = new Vector3();
  function toScreen(p, obj) {
    v.copy(p).applyMatrix4(obj.matrixWorld).project(camera);
    return [(v.x + 1) / 2 * vw, (1 - v.y) / 2 * vh];
  }

  const corners = [];
  function frameRect() {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const c of corners) { const [x, y] = toScreen(c, pivot); x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    return [x0, y0, x1, y1];
  }

  let last = performance.now(), t0 = last;
  function tick(now) {
    if (!running) return;
    requestAnimationFrame(tick);
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const time = (now - t0) / 1000;
    const pr = progress();
    const tg = targets(pr);
    // entrance show: spin + drop onto the floor, then a red ripple
    const ip = reduce ? 1 : introAt ? Math.min(1, (now - introAt) / 2300) : 0;
    const e = 1 - Math.pow(1 - ip, 3);
    const eb = ip >= 1 ? 1 : 1 + 2.2 * Math.pow(ip - 1, 3) + 1.2 * Math.pow(ip - 1, 2); // ease-out-back
    if (!landAt && ip > 0.62) { landAt = now; land(); fire('choufha:landed'); }
    const k = primed ? 1 - Math.exp(-dt * (reduce ? 20 : 5.5)) : 1;
    primed = true;
    for (const key of Object.keys(cur)) cur[key] += (tg[key] - cur[key]) * k;
    mouse.x += (mouse.tx - mouse.x) * (1 - Math.exp(-dt * 3));
    mouse.y += (mouse.ty - mouse.y) * (1 - Math.exp(-dt * 3));

    // place the rig in screen-relative units
    const visH = 2 * Math.tan(MathUtils.degToRad(camera.fov / 2)) * dist, visW = visH * camera.aspect;
    const s = (0.7 + 0.3 * e) * Math.min((cur.h * visH) / size.y, (mobile ? 0.72 : 0.42) * visW / Math.hypot(size.x, size.z));
    rig.scale.setScalar(s);
    rig.position.set(cur.x * visW, target.y - size.y * s / 2 + cur.y * visH + (1 - eb) * 0.75 * visH, 0);
    const heroW = Math.max(0, 1 - pr);              // livelier idle turn while on the hero
    const sway = reduce ? 0 : Math.sin(time * 0.38) * (0.06 + 0.34 * heroW);
    pivot.rotation.y = cur.ry + sway + mouse.x * 0.18 - (1 - e) * Math.PI * 2.2 * side;
    rig.rotation.x = cur.rx + mouse.y * 0.05;

    // materials step: cycle colours
    if (fabric) {
      if (!userPicked && cur.mat > 0.55 && now - lastSwap > 1700) { setColor((colorIdx + 1) % COLORS.length); lastSwap = now; }
      if (cur.mat < 0.2 && !userPicked && colorIdx !== 0 && now - lastSwap > 600) setColor(0);
      fabric.color.lerp(COLORS[colorIdx], 1 - Math.exp(-dt * 6));
      if (pillow && PILLOW) pillow.color.lerp(PILLOW[colorIdx], 1 - Math.exp(-dt * 6));
    }

    // AR rings
    const lt = landAt ? (now - landAt) / 1400 : 1;
    const fx = lt < 1 ? 1 - lt : 0;                  // landing ripple
    ringMat.opacity = Math.max(cur.ar * 0.9, fx * 0.8);
    const pulse = lt < 1 ? lt : (time % 2) / 2;
    ring2.scale.setScalar(1 + pulse * (lt < 1 ? 1.1 : 0.35));
    ring2Mat.opacity = lt < 1 ? fx * 0.9 : cur.ar * (1 - pulse) * 0.6;
    rim.intensity = 0.9 + fx * 2.5;
    blob.material.opacity = 0.3 + 0.7 * eb;
    catcher.material.opacity = 0.32 * (1 - cur.ar * 0.4);

    renderer.render(scene, camera);

    // HTML overlays
    if (dims) {
      dimMat.opacity = cur.dims;
      labels.forEach((el, i) => {
        const [x, y] = toScreen(anchors[i], pivot);
        el.style.opacity = cur.dims.toFixed(3);
        const lx = Math.min(Math.max(x - el.offsetWidth / 2, 8), vw - el.offsetWidth - 8);
        el.style.transform = `translate(${lx.toFixed(1)}px,${(y - el.offsetHeight / 2).toFixed(1)}px)`;
      });
    }
    if (corners.length) {
      const [x0, y0, x1, y1] = frameRect(), pad = 22 + (1 - cur.ar) * 40;
      frame.style.opacity = Math.max(0, cur.ar * 1.3 - 0.3).toFixed(3);
      frame.style.width = (x1 - x0 + pad * 2).toFixed(1) + 'px';
      frame.style.height = (y1 - y0 + pad * 2).toFixed(1) + 'px';
      frame.style.transform = `translate(${(x0 - pad).toFixed(1)}px,${(y0 - pad).toFixed(1)}px)`;
      box.style.setProperty('--gx', (((x0 + x1) / 2) / vw * 100).toFixed(1) + '%');
    }
  }

  function setColor(i) {
    colorIdx = i;
    swatchBtns.forEach((b, j) => b.setAttribute('aria-pressed', j === i));
  }
  swatchBtns.forEach((b, j) => {
    b.style.pointerEvents = 'auto';
    b.addEventListener('click', () => { userPicked = true; setColor(j); });
  });

  function start() { if (!running && visible && model) { running = true; last = performance.now(); requestAnimationFrame(tick); } }
  function stop() { running = false; }

  new IntersectionObserver(([e]) => { visible = e.isIntersecting; visible ? start() : stop(); }).observe(story);
  addEventListener('resize', () => { measure(); }, { passive: true });
  mq.addEventListener && mq.addEventListener('change', () => { primed = false; measure(); });
  addEventListener('load', measure);
  if (!reduce) addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    mouse.tx = (e.clientX / innerWidth - 0.5) * 2; mouse.ty = (e.clientY / innerHeight - 0.5) * 2;
  }, { passive: true });

  measure();
  new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).load(tag.dataset.model, (gltf) => {
    model = gltf.scene;
    const bb = new Box3().setFromObject(model);
    bb.getSize(size);
    const c = bb.getCenter(new Vector3());
    model.position.set(-c.x, -bb.min.y, -c.z);
    model.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true; o.receiveShadow = true;
      const n = o.material && o.material.name;
      if (n === 'Fabric') fabric = o.material;
      if (n === 'Pillow') { pillow = o.material; const r = pillow.color.clone(); PILLOW = [r, r, new Color('#3a3a40'), r]; }
    });
    pivot.add(model);
    blob.scale.set(size.x / 1.1, size.z / 1.1, 1);
    for (const x of [-1, 1]) for (const y of [0, 1]) for (const z of [-1, 1]) corners.push(new Vector3(x * size.x / 2, y * size.y, z * size.z / 2));
    buildDims();
    story.classList.add('ready');
    fire('c3d:ready');
    measure();
    start();
  }, (ev) => { if (ev.total) fire('c3d:progress', ev.loaded / ev.total); },
  () => { story.classList.add('no-webgl'); fire('c3d:fail'); land(); });
}
