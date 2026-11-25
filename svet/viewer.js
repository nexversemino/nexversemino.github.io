// Laya World · živý svět – prohlížeč pro diváky.
// Veřejně: stránka na morfiai.eu/svet stahuje stav světa z live.morfiai.eu (Hostinger), kam ho posílá herní PC.
// Místně: připojí se přes WebSocket přímo k python/live_relay.py. Stránka jen zobrazuje, nic neovládá.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

const params = new URLSearchParams(location.search);
const isLocal = ['localhost', '127.0.0.1', ''].includes(location.hostname);
// ?api=… vynutí režim Hostingeru i při místním testu.
const API = (params.get('api') || window.LIVE_API || 'https://live.morfiai.eu').replace(/\/$/, '');
const USE_WS = isLocal && !params.get('api');
const WS_URL = `ws://${location.host || '127.0.0.1:8400'}/ws`;
const TERRAIN = USE_WS ? 'data' : `${API}/terrain`;
const LOW_END = matchMedia('(max-width: 720px)').matches || (navigator.hardwareConcurrency || 4) <= 4;
// ?embed=1 = vložený náhled (stránka morfiai.eu/laya): bez panelu, kamera krouží, kolečko posouvá stránku.
const EMBED = params.get('embed') === '1';
if (EMBED) {
  document.body.classList.add('embed');
  document.querySelector('.brand a')?.setAttribute('target', '_top');
}

// ---------- scéna ----------
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !LOW_END });
renderer.setPixelRatio(Math.min(devicePixelRatio, LOW_END ? 1.25 : 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
const labels = new CSS2DRenderer();
labels.domElement.style.cssText = 'position:fixed;inset:0;pointer-events:none';
document.body.appendChild(labels.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x9fb8c6, 400, 3200);
const camera = new THREE.PerspectiveCamera(55, 1, 0.5, 9000);
camera.position.set(40, 40, 40);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI * 0.49;
controls.minDistance = 4;
controls.maxDistance = 2500;
if (EMBED) { controls.enableZoom = false; controls.autoRotate = true; controls.autoRotateSpeed = 0.5; }

const hemi = new THREE.HemisphereLight(0xdfefff, 0x3a3020, 1.1);
const sun = new THREE.DirectionalLight(0xfff1d6, 1.6);
sun.position.set(300, 600, 200);
scene.add(hemi, sun);

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  labels.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

// ---------- terén ----------
// Hrubý terén celé mapy (16 m) + jemné dlaždice 2 m kolem sledovaného místa,
// aby postavy stály na zemi a „neplavaly“.
const terrainMaterial = new THREE.MeshLambertMaterial({ vertexColors: true });
const tileMaterial = new THREE.MeshLambertMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });

function colorAt(c, y, slope, cell) {
  if (y < -1) c.setRGB(0.55, 0.52, 0.42);
  else if (y < 2) c.setRGB(0.78, 0.72, 0.52);
  else if (slope > cell * 0.9) c.setRGB(0.47, 0.45, 0.42);
  else if (y > 120) c.setRGB(0.92, 0.93, 0.95);
  else c.setRGB(0.30 + y / 600, 0.48 - y / 900, 0.24);
}

// Mřížka výšek → mesh. h(ix, iz) vrací výšku, x0/z0 je roh, cell rozestup bodů.
function gridMesh(size, stride, h, x0, z0, cell, material) {
  const m = Math.floor((size - 1) / stride) + 1;
  const pos = new Float32Array(m * m * 3), col = new Float32Array(m * m * 3);
  const c = new THREE.Color();
  for (let a = 0; a < m; a++) for (let b = 0; b < m; b++) {
    const ix = Math.min(a * stride, size - 1), iz = Math.min(b * stride, size - 1);
    const y = h(ix, iz), k = (a * m + b) * 3;
    pos[k] = x0 + ix * cell; pos[k + 1] = y; pos[k + 2] = z0 + iz * cell;
    const slope = Math.abs(h(Math.min(ix + 1, size - 1), iz) - y) + Math.abs(h(ix, Math.min(iz + 1, size - 1)) - y);
    colorAt(c, y, slope, cell);
    col[k] = c.r; col[k + 1] = c.g; col[k + 2] = c.b;
  }
  const index = new Uint32Array((m - 1) * (m - 1) * 6);
  let t = 0;
  for (let a = 0; a < m - 1; a++) for (let b = 0; b < m - 1; b++) {
    const i = a * m + b;
    index.set([i, i + 1, i + m, i + 1, i + m + 1, i + m], t); t += 6;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setIndex(new THREE.BufferAttribute(index, 1));
  g.computeVertexNormals();
  return new THREE.Mesh(g, material);
}

// Terén se načte jednou; když se to nepovede (Hostinger zrovna nedostupný), zkusí se znovu.
let terrainState = 'none';   // none | loading | done
function ensureTerrain() {
  if (terrainState !== 'none') return;
  terrainState = 'loading';
  loadTerrain().then(() => { terrainState = 'done'; })
    .catch((e) => { terrainState = 'none'; console.warn('Terén se nenačetl, zkusím to znovu', e); });
}
async function loadTerrain() {
  const metaResponse = await fetch(`${TERRAIN}/terrain.json`);
  if (!metaResponse.ok) throw new Error(`terrain.json: HTTP ${metaResponse.status}`);
  const meta = await metaResponse.json();
  const raw = new Uint16Array(await (await fetch(`${TERRAIN}/terrain.bin`)).arrayBuffer());
  const span = meta.max - meta.min;
  const h = (ix, iz) => meta.min + raw[ix * meta.size + iz] / 65535 * span;
  const coarse = gridMesh(meta.size, LOW_END ? 2 : 1, h, -meta.half, -meta.half, meta.cell, terrainMaterial);
  coarse.position.y = -1.5;   // jemné dlaždice leží nad ním, hrubý terén nevykukuje
  scene.add(coarse);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(meta.half * 2.6, meta.half * 2.6),
    new THREE.MeshLambertMaterial({ color: 0x2f6f8f, transparent: true, opacity: 0.78 }));
  water.rotation.x = -Math.PI / 2;
  scene.add(water);
  try { tiles.index = await (await fetch(`${TERRAIN}/tiles/index.json`)).json(); tiles.available = new Set(tiles.index.tiles); }
  catch { tiles.index = null; }
}

const tiles = { index: null, available: new Set(), loaded: new Map(), loading: new Set() };
async function loadTile(key) {
  tiles.loading.add(key);
  try {
    const buf = await (await fetch(`${TERRAIN}/tiles/${key}.bin`)).arrayBuffer();
    const head = new Float32Array(buf, 0, 2), data = new Uint16Array(buf, 8);
    const { size, tile, cell, half } = tiles.index, span = head[1] - head[0];
    const [tx, tz] = key.split('_').map(Number);
    const mesh = gridMesh(size, LOW_END ? 2 : 1, (ix, iz) => head[0] + data[ix * size + iz] / 65535 * span,
      tx * tile - half, tz * tile - half, cell, tileMaterial);
    scene.add(mesh);
    tiles.loaded.set(key, mesh);
  } catch { /* dlaždice chybí – zůstane hrubý terén */ }
  tiles.loading.delete(key);
}
function updateTiles(center) {
  if (!tiles.index || !center) return;
  const { tile, half } = tiles.index;
  const cx = Math.floor((center.x + half) / tile), cz = Math.floor((center.z + half) / tile);
  const r = LOW_END ? 0 : 1;
  for (let x = cx - r; x <= cx + r; x++) for (let z = cz - r; z <= cz + r; z++) {
    const key = `${x}_${z}`;
    if (tiles.available.has(key) && !tiles.loaded.has(key) && !tiles.loading.has(key)) loadTile(key);
  }
  for (const [key, mesh] of tiles.loaded) {
    const [x, z] = key.split('_').map(Number);
    if (Math.abs(x - cx) > r + 1 || Math.abs(z - cz) > r + 1) {
      scene.remove(mesh); mesh.geometry.dispose(); tiles.loaded.delete(key);
    }
  }
}
setInterval(() => updateTiles(controls.target), 1000);

// ---------- postavy ----------
const MAX_PEOPLE = 400, MAX_VEHICLES = 200;
const capsule = new THREE.CapsuleGeometry(0.32, 1.1, 3, 8); capsule.translate(0, 0.87, 0);
const people = new THREE.InstancedMesh(capsule, new THREE.MeshLambertMaterial(), MAX_PEOPLE);
people.count = 0; people.frustumCulled = false;
const box = new THREE.BoxGeometry(1, 1, 1); box.translate(0, 0.5, 0);
const vehicles = new THREE.InstancedMesh(box, new THREE.MeshLambertMaterial({ color: 0xd9dde0 }), MAX_VEHICLES);
vehicles.count = 0; vehicles.frustumCulled = false;
const beadGeo = new THREE.SphereGeometry(0.42, 12, 10);
const beads = new THREE.InstancedMesh(beadGeo, new THREE.MeshLambertMaterial({ color: 0x7fd36b }), 32);
beads.count = 0; beads.frustumCulled = false;
const hero = new THREE.Mesh(capsule, new THREE.MeshLambertMaterial({ color: 0xf2b84b, emissive: 0x3a2500 }));
const villain = new THREE.Mesh(capsule, new THREE.MeshLambertMaterial({ color: 0xc0392b, emissive: 0x300000 }));
villain.scale.setScalar(1.8);
hero.visible = villain.visible = false;
const ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.15, 32), new THREE.MeshBasicMaterial({ color: 0xf2b84b, transparent: true, opacity: 0.85, side: THREE.DoubleSide }));
ring.rotation.x = -Math.PI / 2;
scene.add(people, vehicles, beads, hero, villain, ring);

const tagEl = document.createElement('div');
tagEl.style.cssText = 'padding:2px 8px;border-radius:6px;background:rgba(0,0,0,.55);color:#fff;font:600 12px system-ui;white-space:nowrap';
const tag = new CSS2DObject(tagEl);
scene.add(tag);

// Plynulý pohyb: každá entita má cíl a vykreslení se k němu dotahuje.
const tracks = new Map();   // id -> {p: Vector3, target: Vector3, yaw, targetYaw}
function track(id, p, yaw) {
  let t = tracks.get(id);
  const target = new THREE.Vector3(p[0], p[1], p[2]);
  if (!t || t.p.distanceTo(target) > 30) { t = { p: target.clone(), target, yaw, targetYaw: yaw }; tracks.set(id, t); }
  t.target.copy(target); t.targetYaw = yaw; t.seen = performance.now();
  return t;
}
function lerpAngle(a, b, k) { let d = ((b - a + Math.PI) % (2 * Math.PI)) - Math.PI; if (d < -Math.PI) d += 2 * Math.PI; return a + d * k; }

// ---------- stav ----------
const state = { core: null, crowd: null, roster: { people: {}, actions: {}, vehicles: [] }, online: false, viewers: 0 };
let follow = params.get('follow') || 'hero';
const tmp = new THREE.Object3D(), tmpColor = new THREE.Color();
function colorFor(id) { let h = 0; for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return tmpColor.setHSL((h % 360) / 360, 0.45, 0.6); }

function followPoint() {
  if (follow === 'hero') return tracks.get('hero')?.p;
  if (follow === 'villain') return tracks.get('villain')?.p;
  if (follow === 'snake') return tracks.get('bead:0')?.p;
  if (follow.startsWith('person:')) return tracks.get(follow)?.p;
  return null;
}

let lastFollow = null;
function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min(0.1, (now - (animate.last || now)) / 1000); animate.last = now;
  const k = 1 - Math.exp(-8 * dt);
  for (const t of tracks.values()) { t.p.lerp(t.target, k); t.yaw = lerpAngle(t.yaw, t.targetYaw, k); }

  const c = state.core;
  const hT = tracks.get('hero');
  hero.visible = !!(c?.hero && hT && c.hero.visible !== false);
  if (hero.visible) { hero.position.copy(hT.p); hero.rotation.y = hT.yaw; }
  const vT = tracks.get('villain');
  villain.visible = !!(c?.villain && vT);
  if (villain.visible) { villain.position.copy(vT.p); villain.rotation.y = vT.yaw; }

  const snake = c?.snake || [];
  beads.count = snake.length;
  for (let i = 0; i < snake.length; i++) {
    const t = tracks.get('bead:' + i); if (!t) continue;
    tmp.position.copy(t.p); tmp.rotation.set(0, 0, 0); tmp.scale.setScalar(i === 0 ? 1.35 : 1); tmp.updateMatrix();
    beads.setMatrixAt(i, tmp.matrix);
  }
  beads.instanceMatrix.needsUpdate = true;

  const crowd = state.crowd;
  let n = 0;
  for (const row of crowd?.people || []) {
    if (n >= MAX_PEOPLE) break;
    const t = tracks.get('person:' + row[0]); if (!t) continue;
    tmp.position.copy(t.p); tmp.rotation.set(0, t.yaw, 0); tmp.scale.setScalar(1); tmp.updateMatrix();
    people.setMatrixAt(n, tmp.matrix); people.setColorAt(n, colorFor(row[0])); n++;
  }
  people.count = n; people.instanceMatrix.needsUpdate = true; if (people.instanceColor) people.instanceColor.needsUpdate = true;
  n = 0;
  for (const row of crowd?.vehicles || []) {
    if (n >= MAX_VEHICLES) break;
    const t = tracks.get('car:' + row[0]); if (!t) continue;
    const dims = state.roster.vehicles[row[0]] || { w: 2, l: 4.4, h: 1.5 };
    tmp.position.copy(t.p); tmp.rotation.set(0, t.yaw, 0); tmp.scale.set(dims.w, dims.h, dims.l); tmp.updateMatrix();
    vehicles.setMatrixAt(n++, tmp.matrix);
  }
  vehicles.count = n; vehicles.instanceMatrix.needsUpdate = true;

  // Kamera jede s vybranou postavou, divák si ji může otáčet a přibližovat.
  const fp = followPoint();
  ring.visible = tag.visible = !!fp;
  if (fp) {
    if (lastFollow) { const d = fp.clone().sub(lastFollow); camera.position.add(d); controls.target.add(d); }
    else { controls.target.copy(fp); camera.position.copy(fp).add(new THREE.Vector3(18, 12, 18)); }
    lastFollow = fp.clone();
    ring.position.set(fp.x, fp.y + 0.05, fp.z);
    tag.position.set(fp.x, fp.y + (follow === 'villain' ? 4 : 2.4), fp.z);
  } else lastFollow = null;
  controls.update();
  renderer.render(scene, camera);
  labels.render(scene, camera);
}

// ---------- denní doba ----------
function applyHour(hour) {
  const day = Math.max(0, Math.sin((hour - 6) / 12 * Math.PI));
  const sky = new THREE.Color().setRGB(0.05 + 0.55 * day, 0.08 + 0.64 * day, 0.14 + 0.66 * day);
  scene.background = sky; scene.fog.color.copy(sky);
  sun.intensity = 0.15 + 1.6 * day; hemi.intensity = 0.35 + 0.8 * day;
  const a = (hour - 6) / 12 * Math.PI;
  sun.position.set(Math.cos(a) * 600, Math.max(80, Math.sin(a) * 700), 250);
}
applyHour(12);

// ---------- data ----------
function onMessage(msg) {
  if (msg.type === 'status') { state.online = msg.online; state.viewers = msg.viewers; renderStatus(); return; }
  if (msg.type === 'roster') { state.roster = { people: msg.people || {}, actions: msg.actions || {}, vehicles: msg.vehicles || [] }; return; }
  if (msg.type === 'core') {
    state.core = msg;
    if (msg.hero) track('hero', msg.hero.p, msg.hero.yaw);
    if (msg.villain) track('villain', msg.villain.p, msg.villain.yaw);
    (msg.snake || []).forEach((p, i) => track('bead:' + i, p, 0));
    if (msg.world) applyHour(msg.world.hour ?? 12);
    renderInfo();
  }
  if (msg.type === 'crowd') {
    state.crowd = msg;
    for (const [id, p, yaw] of msg.people) track('person:' + id, p, yaw);
    for (const [i, p, yaw] of msg.vehicles) track('car:' + i, p, yaw);
  }
}

// Místně: WebSocket přímo k relayi na PC.
let socket, retry = 1000;
function connectWs() {
  setStatus('Připojuji…', false);
  try { socket = new WebSocket(WS_URL); } catch { return scheduleReconnect(); }
  socket.onopen = () => { retry = 1000; };
  socket.onmessage = (e) => { try { onMessage(JSON.parse(e.data)); } catch { /* poškozená zpráva */ } };
  socket.onclose = () => { state.online = false; renderStatus(true); scheduleReconnect(); };
}
function scheduleReconnect() { setTimeout(connectWs, retry); retry = Math.min(retry * 1.6, 15000); }

// Veřejně: Hostinger neumí příchozí WebSocket, takže si stránka stav světa stahuje
// dvakrát za sekundu jako malý JSON. Starší než 8 s = PC je vypnuté, Laya spí.
const OFFLINE_AGE = 8;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function pollLoop() {
  const sid = Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(16).padStart(2, '0')).join('');
  let lastServerTime = 0, rosterAt = 0, pingAt = 0;
  setStatus('Připojuji…', false);
  for (;;) {
    let online = false, reachable = true;
    try {
      const r = await fetch(`${API}/state/state.json?_=${Date.now()}`, { cache: 'no-store' });
      if (r.ok) {
        const s = await r.json();
        const serverNow = Date.parse(r.headers.get('Date') || '') / 1000;
        const age = Number.isFinite(serverNow) && s.server_time ? serverNow - s.server_time : Infinity;
        online = !!s.core && age < OFFLINE_AGE;
        state.viewers = s.viewers || state.viewers;
        if (online && s.server_time !== lastServerTime) {
          lastServerTime = s.server_time;
          onMessage({ ...s.core, type: 'core' });
          if (s.crowd) onMessage({ ...s.crowd, type: 'crowd' });
        }
      } else if (r.status !== 404) reachable = false;
    } catch { reachable = false; }
    const now = Date.now();
    if (online && now - rosterAt > 15000) {
      rosterAt = now;
      fetch(`${API}/state/roster.json?_=${now}`, { cache: 'no-store' }).then((r) => r.ok && r.json())
        .then((roster) => { if (roster) onMessage({ ...roster, type: 'roster' }); else rosterAt = 0; })
        .catch(() => { rosterAt = 0; });   // jména ještě nejsou – zkusit hned při dalším kole
    }
    if (now - pingAt > 30000) {
      pingAt = now;
      fetch(`${API}/api/ping.php?s=${sid}`, { cache: 'no-store' }).then((r) => r.ok && r.json())
        .then((p) => { if (p) state.viewers = p.viewers; }).catch(() => {});
    }
    if (online !== state.online || !reachable) { state.online = online; renderStatus(!reachable); }
    else if (online) renderStatus();
    await sleep(online ? 500 : 3000);
  }
}
function connect() { if (USE_WS) connectWs(); else pollLoop(); }

// ---------- panel ----------
const $ = (id) => document.getElementById(id);
function setStatus(text, online) { $('status').className = 'status ' + (online ? 'online' : 'offline'); $('status').querySelector('b').textContent = text; }
function renderStatus(disconnected = false) {
  setStatus(state.online ? 'Laya je vzhůru · živě' : disconnected ? 'Nedostupné' : 'Laya spí', state.online);
  $('sleeping').hidden = state.online;
  const video = document.querySelector('.sleeping-video');   // smyčka ze hry jen když Laya spí
  if (video) { if (state.online) video.pause(); else video.play().catch(() => {}); }
  $('viewers').textContent = state.online ? `${state.viewers} ${state.viewers === 1 ? 'divák' : state.viewers < 5 ? 'diváci' : 'diváků'}` : '';
}
// Názvy taktik stejně jako v python/directives.py (LABELS) + pár dalších, které hra posílá.
const tacticNames = {
  pursue: 'pronásleduje', intercept: 'nadbíhá', search: 'hledá', flee: 'utíká', zigzag: 'kličkuje',
  recover: 'odpočívá a sbírá síly', obstacle: 'obchází překážku', retreat: 'ustupuje', train: 'trénuje',
  disengage: 'vyhýbá se boji', attack: 'útočí', explore: 'prozkoumává', rest: 'odpočívá', wander: 'toulá se',
};
function fmt(v) {
  if (v == null || v === '') return '—';
  if (typeof v === 'string') return tacticNames[v] || v;
  if (typeof v === 'object') return [tacticNames[v.action] || v.action, v.reason].filter(Boolean).join(' — ') || JSON.stringify(v).slice(0, 120);
  return String(v);
}
const roleNames = { prey: 'Hrdina', predator: 'Had', combat: 'Boj', hunter: 'Lovec' };
const providerNames = {
  laya: 'Rozhoduje Laya (místní model)', loading: 'Laya se probouzí…', rules: 'Záložní pravidla',
  heuristic_fallback: 'Záložní pravidla – Laya právě nestíhá', 'čekám': 'Laya se probouzí…',
};
function renderInfo() {
  const c = state.core; if (!c) return;
  const laya = c.laya || {};
  const rows = [];
  for (const role of ['prey', 'predator']) if (laya[role]) rows.push([roleNames[role], fmt(laya[role])]);
  for (const [role, text] of Object.entries(laya.observations || {})) rows.push([`Vnímá (${roleNames[role] || role})`, fmt(text)]);
  $('laya').replaceChildren(...rows.flatMap(([k, v]) => { const dt = document.createElement('dt'), dd = document.createElement('dd'); dt.textContent = k; dd.textContent = v; return [dt, dd]; }));
  $('provider').textContent = providerNames[laya.provider] || (laya.provider ? `Zdroj: ${laya.provider}` : '');
  const weatherNames = { auto: 'proměnlivé počasí', clear: 'jasno', rain: 'déšť', fog: 'mlha', storm: 'bouřka' };
  const w = c.world || {};
  const hh = Math.floor(w.hour ?? 0), mm = Math.floor(((w.hour ?? 0) % 1) * 60);
  const weather = w.weather?.mode || w.weather?.kind || w.weather?.name || '';
  $('world').textContent = `Čas ve světě ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}${weather ? ' · ' + (weatherNames[weather] || weather) : ''}${w.paused ? ' · pozastaveno' : ''}`;
  $('follow-buttons').querySelector('[data-follow=snake]').hidden = !(c.snake && c.snake.length);
  $('follow-buttons').querySelector('[data-follow=villain]').hidden = !c.villain;
  renderFollow();
}
function renderFollow() {
  let name = '—', detail = '';
  const c = state.core;
  if (follow === 'hero' && c?.hero) { name = 'Hrdina'; detail = `${c.hero.activity || ''}${c.hero.speed ? ` · ${c.hero.speed.toFixed(1)} m/s` : ''}${c.hero.health != null ? ` · životy ${c.hero.health}` : ''}`; }
  else if (follow === 'snake') { name = 'Korálkový had'; detail = `${c?.snake?.length || 0} korálků`; }
  else if (follow === 'villain') { name = 'Záporák'; }
  else if (follow.startsWith('person:')) {
    const id = follow.slice(7), info = state.roster.people[id] || {};
    const row = state.crowd?.people.find((r) => r[0] === id);
    name = info.name || id; detail = [info.job, state.roster.actions[row?.[3]] || row?.[3]].filter(Boolean).join(' · ');
  } else if (follow === 'free') { name = 'Volná kamera'; detail = 'Táhni myší, kolečkem přibliž.'; }
  $('follow-name').textContent = name; $('follow-detail').textContent = detail; tagEl.textContent = name;
  document.querySelectorAll('[data-follow]').forEach((b) => b.classList.toggle('active', b.dataset.follow === follow));
}
function setFollow(value) { follow = value; lastFollow = null; renderFollow(); renderPeople(); }
$('follow-buttons').addEventListener('click', (e) => { const b = e.target.closest('[data-follow]'); if (b) setFollow(b.dataset.follow); });

function renderPeople() {
  const q = $('people-filter').value.trim().toLowerCase();
  const rows = state.crowd?.people || [];
  $('people-count').textContent = rows.length ? `(${rows.length})` : '';
  const items = [];
  for (const row of rows) {
    const info = state.roster.people[row[0]] || {};
    const name = info.name || row[0];
    if (q && !name.toLowerCase().includes(q)) continue;
    const li = document.createElement('li');
    li.dataset.id = row[0];
    li.className = follow === 'person:' + row[0] ? 'active' : '';
    li.append(name);
    const s = document.createElement('span'); s.textContent = state.roster.actions[row[3]] || row[3] || ''; li.append(s);
    items.push(li);
    if (items.length >= 150) break;
  }
  $('people').replaceChildren(...items);
}
$('people').addEventListener('click', (e) => { const li = e.target.closest('li'); if (li) setFollow('person:' + li.dataset.id); });
$('people-filter').addEventListener('input', renderPeople);
setInterval(() => { renderPeople(); renderFollow(); }, 1000);
$('panel-toggle').addEventListener('click', () => $('panel').classList.toggle('hidden'));

// ---------- start ----------
ensureTerrain();
setInterval(() => { if (state.online) ensureTerrain(); }, 5000);
requestAnimationFrame(animate);
connect();
