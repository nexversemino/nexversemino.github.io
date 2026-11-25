// Štítek u náhledu živého světa na /laya/: „Živě teď“, nebo „Laya spí“.
// Jen čte veřejný stav světa (stejný, jaký stahuje /svet/). Když se nepodaří, štítek zůstane neutrální.
const OFFLINE_AGE = 8;   // s – stejné jako ve svet/viewer.js

async function check(badge) {
  try {
    const url = badge.dataset.liveStatus + '?_=' + Date.now();
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) throw new Error(String(r.status));
    const s = await r.json();
    const serverNow = Date.parse(r.headers.get('Date') || '') / 1000;
    const live = !!s.core && Number.isFinite(serverNow) && serverNow - s.server_time < OFFLINE_AGE;
    badge.textContent = live ? '● Živě teď' : '☾ Laya právě spí · ukázka ze hry';
    badge.classList.toggle('is-live', live);
    return live;
  } catch {
    badge.textContent = '☾ Laya právě spí · ukázka ze hry';
    badge.classList.remove('is-live');
    return false;
  }
}

for (const badge of document.querySelectorAll('[data-live-status]')) {
  const loop = async () => { await check(badge); setTimeout(loop, 30000); };
  loop();
}
