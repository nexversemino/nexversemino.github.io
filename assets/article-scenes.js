/* Animated story scenes for the "Firma, která se napsala sama" article.
   Each scene is a deterministic canvas mini-animation that plays once when the
   reader scrolls it into view. Clicking (or pressing Enter) replays it.
   modified: shorter legs/arms, blonde hair, doom dark ages, coffee loading,
   ideas spawn products, dcera with own table, armada agents uniform/heels/hats,
   slozite with little ladies/stars/clouds, firma writing/throw page/sry */

const STAGE_W = 640;
const STAGE_H = 260;
const GROUND = 212;

const C = {
  cyan: '#00f7f8',
  pink: '#ff30d3',
  lime: '#a7fb0f',
  orange: '#ff9010',
  violet: '#a672ff',
  white: '#e9f8ff',
  dim: 'rgba(255,255,255,.28)',
  blond: '#ffe4b5',
  bgDark: '#0d0d14',
};
const MONO = '"JetBrains Mono",ui-monospace,SFMono-Regular,Menlo,monospace';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, p) => a + (b - a) * p;
const ease = (p) => p * p * (3 - 2 * p);
const back = (p) => { const c1 = 1.70158; const c3 = c1 + 1; return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2); };
const seg = (t, a, b) => clamp((t - a) / (b - a || 1), 0, 1);

// ---- helpery ----
function line(ctx, x1, y1, x2, y2, w, color) {
  ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
}
function circle(ctx, x, y, r, color, fill) {
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
  if (fill) { ctx.fillStyle = color; ctx.fill(); }
  else { ctx.strokeStyle = color; ctx.lineWidth = Math.max(2, r * 0.16); ctx.stroke(); }
}
function box(ctx, x, y, w, h, color, r) {
  r = Math.min(r || 0, w / 2, h / 2); ctx.fillStyle = color;
  ctx.beginPath(); if (!r) { ctx.rect(x, y, w, h); }
  else { ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r); } ctx.closePath(); ctx.fill();
}
function strokeBox(ctx, x, y, w, h, r, color, lw) {
  r = Math.min(r || 0, w / 2, h / 2); ctx.strokeStyle = color; ctx.lineWidth = lw || 2;
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); ctx.stroke();
}
function txt(ctx, s, x, y, size, color, align, weight) {
  ctx.font = (weight || '700') + ' ' + size + 'px ' + MONO; ctx.fillStyle = color;
  ctx.textAlign = align || 'center'; ctx.textBaseline = 'middle'; ctx.fillText(s, x, y);
}
function heart(ctx, x, y, s, color) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s / 16, s / 16); ctx.fillStyle = color;
  ctx.beginPath(); ctx.moveTo(0, 6); ctx.bezierCurveTo(-12, -3, -7, -12, 0, -6);
  ctx.bezierCurveTo(7, -12, 12, -3, 0, 6); ctx.closePath(); ctx.fill(); ctx.restore();
}
function limb(ctx, x1, y1, x2, y2, l1, l2, bend, w, color) {
  // law of cosines IK
  const dx = x2 - x1; const dy = y2 - y1; const n = Math.hypot(dx, dy) || 1e-6;
  const d = Math.min(n, l1 + l2 - 0.01); const ux = dx / n; const uy = dy / n;
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d); const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  const jx = x1 + ux * a - uy * h * bend; const jy = y1 + uy * a + ux * h * bend;
  line(ctx, x1, y1, jx, jy, w, color);
  line(ctx, jx, jy, x2, y2, w, color);
}
// ---- BLONÝDNÁ HRÁŠĆE ----
// Creates long blonde hair strands around a head position
function blondeHair(ctx, headX, headY, headR, color) {
  ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.lineCap = 'round';
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2 - Math.PI / 2;
    const len = 20 + Math.sin(i * 0.8) * 5;
    const x2 = headX + Math.cos(angle) * (headR + 15);
    const y2 = headY + Math.sin(angle) * (headR + 15) - len;
    if (i) ctx.lineTo(x2, y2); else ctx.moveTo(x2, y2);
  }
  ctx.stroke();
}

// ---- ENGINE ----
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function initFigure(fig) {
  const scene = SCENES[fig.dataset.scene];
  const canvas = fig.querySelector('canvas');
  if (!scene || !canvas) { fig.remove(); return; }
  const ctx = canvas.getContext('2d');
  let t = scene.dur; let raf = 0; let start = 0; let started = false; let finished = true;

  function size() {
    const r = canvas.getBoundingClientRect(); if (!r.width || !r.height) return false;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(r.width * dpr); const h = Math.round(r.height * dpr);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    return true;
  }
  function paint(time) {
    if (!size()) return;
    ctx.setTransform(canvas.width / STAGE_W, 0, 0, canvas.height / STAGE_H, 0, 0);
    ctx.clearRect(0, 0, STAGE_W, STAGE_H);
    t = Math.min(scene.dur, (time - start) / 1000);
    scene.draw(ctx, t);
    if (t >= scene.dur) { raf = 0; playing = false; finished = true; return; }
    raf = requestAnimationFrame(paint);
  }
  let playing = false;
  function play() { if (reduced) return; cancelAnimationFrame(raf); start = performance.now(); playing = true; raf = requestAnimationFrame(paint); }
  function pause() { if (raf) cancelAnimationFrame(raf); raf = 0; playing = false; }
  function resume() { if (reduced || playing || finished || !started) return; start = performance.now() - t * 1000; playing = true; raf = requestAnimationFrame(paint); }
  function replay() { if (reduced) { paint(scene.dur); return; } started = true; play(); }

  paint(scene.dur);
  if (reduced) fig.classList.add('is-in');

  fig.addEventListener('click', replay);
  fig.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); replay(); } });

  if ('IntersectionObserver' in window && !reduced) {
    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.intersectionRatio >= 0.4 && !started) { started = true; fig.classList.add('is-in'); play(); }
        else if (entry.intersectionRatio === 0) { pause(); }
        else if (entry.intersectionRatio > 0) { resume(); }
      }
    }, { threshold: [0, 0.4, 0.75] });
    io.observe(fig);
  } else if (!reduced) { fig.classList.add('is-in'); started = true; }
  window.addEventListener('resize', () => paint(t));
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => paint(t));
  }
}

// SCENE_LABELS originally in build.py, kept here for reference
const SCENE_LABELS = {
  firma: 'Firma, která se psala sama',
  doom: 'Nohy nahoru, káva a DOOM',
  napad: 'Nápady se množí',
  dcera: 'Dcera má taky nápad',
  armada: 'Armáda hotových agentů',
  slozite: 'Složité na výstup, jednoduché na vstup',
};

const SCENES = { firma: null, doom: null, napad: null, dcera: null, armada: null, slozite: null };

// ==== SCÉNY ====

// ---- DOOM ----
const doom = {
  dur: 8,
  draw(ctx, t) {
    const A = seg(t, 0, 0.45); ctx.globalAlpha = A;
    box(ctx, 0, GROUND, STAGE_W, STAGE_H - GROUND, C.bgDark);
    // monitor s "DOOM Dark Ages"
    box(ctx, 460, 80, 160, 120, '#111', 4);
    box(ctx, 466, 86, 152, 112, '#222', 3);
    ctx.fillStyle = '#ffe4b5'; ctx.font = '11px ' + MONO; ctx.textAlign = 'left';
    ctx.fillText('DOOM Dark Ages', 474, 114);
    // pixel art démon uleva
    ctx.fillStyle = '#f44';
    for (let i = 0; i < 5; i++) {
      const fx = 540 + i * 28; const fy = 200 + Math.sin(t * 3 + i) * 6;
      box(ctx, fx, fy, 20, 20, '#f44', 2);
    }
    // káva a šálek
    const cupY = lerp(150, 100, seg(t, 0.2, 0.5));
    box(ctx, 100, cupY, 50, 18, 'rgba(255,212,100,.6)', 2);
    ctx.fillStyle = '#8b5a2b'; ctx.fillRect(102, cupY + 2, 46, 12);
    // postava popíjí kávu (t >= 0.6)
    if (t > 0.6) {
      const sip = seg(t, 0.6, 1.0);
      const hx = 95 + sip * 20; const hy = cupY + 5;
      ctx.strokeStyle = C.cyan; ctx.lineWidth = 3; ctx.beginPath();
      ctx.moveTo(95, 140); ctx.lineTo(hx, hy); ctx.stroke();
    }
    // blondýna sedí, nohy nahoru (zkrácené)
    blondeHair(ctx, 60, 80, 16, C.blond);
    circle(ctx, 60, 80, 14, C.blond, true);
    ctx.fillStyle = '#0b0f1a'; ctx.beginPath(); ctx.arc(60, 80, 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(64, 78, 2, 0, Math.PI * 2); ctx.fill();
    // zkrácené tělo
    box(ctx, 52, 94, 36, 44, C.cyan, 3);
    line(ctx, 52, 94, 40, 100, 4, C.cyan);
    line(ctx, 88, 94, 96, 100, 4, C.cyan);
    // nohy nahoru na stole (zkrácené)
    const legLift = ease(seg(t, 0.3, 1.2));
    const footY = lerp(GROUND, 150, legLift);
    const footXleft = 42 + Math.sin(t * 5) * 3;
    const footXright = 104 - Math.sin(t * 5) * 3;
    circle(ctx, footXleft, footY, 5, C.pink, true);
    circle(ctx, footXright, footY, 5, C.pink, true);
    // stol
    box(ctx, 20, GROUND - 12, STAGE_W - 40, 12, 'rgba(255,255,255,.15)', 2);
    ctx.fillStyle = '#fff'; txt(ctx, 'Káva', 125, cupY - 8, 10, C.cyan);
    // loading indicator prvních 1.5 s
    if (t < 1.5) {
      ctx.globalAlpha = A * seg(t, 0, 1.2);
      ctx.fillStyle = C.lime; txt(ctx, 'načítání...', 300, 200, 14, C.lime);
      ctx.globalAlpha = 1;
    }
    ctx.globalAlpha = 1;
  }
};

// ---- NADPAD ----// nápady se mění na konkrétní produkty
const products = [
  { label: 'hra', x: 100, y: 60, color: C.lime },
  { label: 'webovka', x: 260, y: 40, color: C.pink },
  { label: 'eshop', x: 420, y: 70, color: C.orange },
  { label: 'nákupní asistent', x: 560, y: 50, color: C.cyan },
  { label: 'android', x: 80, y: 150, color: C.violet },
  { label: 'telefon', x: 240, y: 170, color: '#ffd700' },
  { label: 'panáček s kloboukem', x: 400, y: 150, color: C.white }
];
const napad = {
  dur: 7,
  draw(ctx, t) {
    const A = seg(t, 0, 0.45); ctx.globalAlpha = A;
    box(ctx, 0, GROUND, STAGE_W, STAGE_H - GROUND, '#0b0f1a');
    // postava vlevo s dlouhými blond vlasy
    blondeHair(ctx, 50, GROUND - 40, 16, C.blond);
    circle(ctx, 50, GROUND - 40, 14, C.blond, true);
    ctx.fillStyle = '#0b0f1a'; ctx.beginPath(); ctx.arc(50, GROUND - 40, 3.5, 0, Math.PI * 2); ctx.fill();
    // tělo
    box(ctx, 40, GROUND - 20, 30, 50, C.cyan, 3);
    limb(ctx, [40, GROUND - 20], [80, GROUND - 20], 5, C.cyan);
    // každý nápad vzejde a promění se na produkt
    products.forEach((p, i) => {
      const prodTime = 0.5 + i * 0.6 + seg(t, 0.2, 5);
      if (t < prodTime) return;
      const pulse = back(seg(t, prodTime, prodTime + 0.4));
      const sx = p.x + Math.sin(t * 3 + i) * 8 * pulse;
      const sy = p.y + Math.cos(t * 2 + i) * 6 * pulse;
      ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(sx, sy, 12 * pulse, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#0b0f1a'; ctx.font = '9px ' + MONO; ctx.textAlign = 'center';
      ctx.fillText(p.label, sx, sy + 20);
    });
    if (t > 3) {
      ctx.fillStyle = 'rgba(255,255,255,.3)'; txt(ctx, 'Každej nápad = jeden nový projekt', 320, 30, 12, C.cyan);
    }
    ctx.globalAlpha = 1;
  }
};

// ---- DCERA ----// máma + dcera vedle sebe
const dcera = {
  dur: 7,
  draw(ctx, t) {
    const A = seg(t, 0, 0.45); ctx.globalAlpha = A;
    box(ctx, 0, GROUND, STAGE_W, STAGE_H - GROUND, '#fafafa');
    // Máma vlevo
    box(ctx, 40, GROUND - 12, 160, 12, '#e0e0e0', 2);
    box(ctx, 44, GROUND - 24, 26, GROUND - 24, '#ddd', 2);
    blondeHair(ctx, 80, GROUND - 40, 15, C.blond);
    circle(ctx, 80, GROUND - 40, 13, C.blond, true);
    ctx.fillStyle = '#0b0f1a'; ctx.beginPath(); ctx.arc(80, GROUND - 40, 3.5, 0, Math.PI * 2); ctx.fill();
    box(ctx, 72, GROUND - 54, 32, 58, C.pink, 3);
    limb(ctx, [72, GROUND - 54], [96, GROUND - 80], 5, C.pink);
    // dcera vpravo - přijde a přitáhne vlastní stůl s počítačem
    const run = seg(t, 1, 3);
    const dx = lerp(560, 260, ease(run));
    const showing = t > 1.5 && t < 4;
    if (showing) {
      blondeHair(ctx, dx, GROUND - 38, 13, '#ffd700');
      circle(ctx, dx, GROUND - 38, 11, '#ffd700', true);
      ctx.fillStyle = '#0b0f1a'; ctx.beginPath(); ctx.arc(dx, GROUND - 38, 3, 0, Math.PI * 2); ctx.fill();
      // dcera má vlastní stůl a počítač
      const daughterDeskY = GROUND - 12;
      box(ctx, dx - 60, daughterDeskY, 80, 12, '#cce5ff', 2);
      box(ctx, dx - 30, daughterDeskY + 4, 40, 20, '#99ccff', 2);
      ctx.fillStyle = '#0b0f1a'; ctx.beginPath(); ctx.arc(dx, GROUND - 20, 8, 0, Math.PI * 2); ctx.fill();
      // bublina "JÁ CHCI TAKY!"
      if (t > 3.2 && t < 4.2) {
        const s = back(seg(t, 3.2, 3.8));
        ctx.save(); ctx.translate(dx, GROUND - 70); ctx.scale(s, s);
        ctx.fillStyle = 'rgba(255,255,255,.9)'; box(ctx, -60, -20, 120, 30, 'rgba(0,0,0,.5)');
        ctx.fillStyle = C.lime; txt(ctx, 'JÁ CHCI TAKY!', 0, 5, 12, '#141a26');
        ctx.restore();
      }
    }
    ctx.fillStyle = '#666'; txt(ctx, '// dcera má taky nápad', 300, 220, 10, C.dim);
    ctx.globalAlpha = 1;
  }
};

// ---- ARMÁDA ----// agenti s uniformou, podpatky, klobouky a AI modely nad nimi
const aiModels = ['qwen', 'gemma', 'π', 'codex', 'claude', 'hermes', 'deepseek', 'argon', 'gemini', 'nemotron'];
const armada = {
  dur: 7,
  draw(ctx, t) {
    const A = seg(t, 0, 0.45); ctx.globalAlpha = A;
    box(ctx, 0, GROUND, STAGE_W, STAGE_H - GROUND, '#1a1a2e');
    for (let i = 0; i < 6; i++) {
      const x = 560 - i * 95;
      const phase = t * 2 + i * 0.3;
      const uniformColor = i % 2 === 0 ? '#3b82f6' : '#ef4444';
      box(ctx, x - 18, GROUND - 78, 36, 68, uniformColor, 4);
      box(ctx, x - 14, GROUND - 86, 28, 12, '#1e40af', 2);
      ctx.fillStyle = '#fafafa'; ctx.beginPath(); ctx.arc(x - 10, GROUND - 82, 3, 0, Math.PI * 2); ctx.fill();
      // podpatky
      ctx.fillStyle = '#b41f1f'; ctx.beginPath(); ctx.arc(x - 22, GROUND - 12, 4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(x + 22, GROUND - 12, 4, 0, Math.PI * 2); ctx.fill();
      // nad hlavou AI model
      const model = aiModels[i];
      ctx.fillStyle = '#fafafa'; ctx.font = '7px ' + MONO; ctx.textAlign = 'center';
      ctx.fillText(model, x, GROUND - 104);
      const headX = x - 14 + Math.sin(phase) * 2;
      ctx.fillStyle = '#fafafa'; ctx.beginPath(); ctx.arc(headX, GROUND - 84, 3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#9aa0a6'; txt(ctx, 'Armáda AI agentů s uniformami a podpatky', 20, 230, 10, C.dim);
    ctx.globalAlpha = 1;
  }
};

// ---- SLOŽITÉ ----// domečky, paníčky, hvězdičky, mraky, komplexní výstup
const slozite = {
  dur: 7,
  draw(ctx, t) {
    const A = seg(t, 0, 0.45); ctx.globalAlpha = A;
    // vstup box - use strokeBox instead of roundRect
    box(ctx, 30, 100, 100, 60, 'rgba(255,255,255,.1)', 4);
    strokeBox(ctx, 30, 100, 100, 60, 8, C.cyan, 2);
    txt(ctx, 'VSTUP', 80, 130, 13, C.cyan);
    // zamotaný výstup - tangle křivky
    const tangleX = 200; const tangleY = 140;
    const tp = ease(seg(t, 1.5, 3.5));
    if (tp > 0) {
      ctx.strokeStyle = C.violet; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath();
      for (let i = 0; i < 200; i++) {
        const u = i / 200; const a = u * Math.PI * 7 + t * 0.5;
        const r = 30 + 16 * Math.sin(u * 9.7) + 9 * Math.cos(u * 5.3);
        const px = tangleX + Math.cos(a) * r; const py = tangleY + Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
    if (t > 2.5) {
      const s = back(seg(t, 2.5, 2.9));
      ctx.globalAlpha = A * seg(t, 2.5, 2.7);
      ctx.fillStyle = C.pink; txt(ctx, '?', 300, 60 - s * 4, 26 * Math.min(1, s), C.pink);
      ctx.globalAlpha = A;
    }
    const buildP = ease(seg(t, 3.5, 4.8));
    if (buildP > 0) {
      ctx.save(); ctx.translate(460, GROUND); ctx.scale(1, buildP); ctx.translate(-460, -GROUND);
      for (let i = 0; i < 5; i++) {
        const wx = 440 + i * 70; const h = 50 + Math.sin(t * 2 + i) * 10;
        box(ctx, wx, GROUND - h - 20, 56, h + 20, '#d4a574', 3);
        ctx.fillStyle = '#e85d75'; ctx.beginPath(); ctx.arc(wx + 20, GROUND - h - 10, 6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fbbf24'; ctx.beginPath(); ctx.arc(wx + 14, GROUND - h - 12, 4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fbbf24'; ctx.beginPath(); ctx.arc(wx + 26, GROUND - h - 12, 4, 0, Math.PI * 2); ctx.fill();
        // hvězdička - fixed: use proper star drawing without accumulating rotations
        ctx.fillStyle = '#fde047';
        const starX = wx + 28; const starY = GROUND - h - 28;
        ctx.save();
        ctx.translate(starX, starY);
        for (let j = 0; j < 5; j++) {
          ctx.rotate(Math.PI * 2 / 5);
          ctx.beginPath();
          ctx.moveTo(0, -6);
          ctx.lineTo(2, 2);
          ctx.lineTo(-2, 2);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
      }
      ctx.restore();
    }
    // mraky nad výstupem
    if (t > 4.5) {
      ctx.fillStyle = 'rgba(0,0,0,.4)';
      for (let i = 0; i < 3; i++) {
        const cx = 520 + i * 40; const cy = 80 + Math.sin(t * 1.5 + i) * 10;
        ctx.beginPath(); ctx.ellipse(cx, cy, 25, 15, 0, 0, Math.PI * 2); ctx.fill();
      }
    }
    blondeHair(ctx, 50, GROUND - 40, 14, C.blond);
    ctx.globalAlpha = 1;
  }
};

// ---- FIRMA (POSLEDNÍ SCÉNA) ----// píše, hodí stránku na zem, píše dál, zmuchlá na diváka
const firma = {
  dur: 9,
  draw(ctx, t) {
    const A = seg(t, 0, 0.5); ctx.globalAlpha = A;
    box(ctx, 0, GROUND, STAGE_W, STAGE_H - GROUND, '#fdfdfd');
    line(ctx, 20, GROUND, STAGE_W - 20, GROUND, 2, '#e0e0e0');
    box(ctx, 80, GROUND - 30, 200, 30, '#f5f0e0', 3);
    const paperX = lerp(80, 250, seg(t, 0.2, 1.2));
    const paperY = GROUND - 45;
    box(ctx, paperX, paperY, 130, 22, '#fff', 3);
    const shown = Math.ceil(seg(t, 0.5, 1.8) * 5);
    if (shown > 0) {
      ctx.fillStyle = C.lime; txt(ctx, 'firma'.slice(0, shown), paperX + 65, paperY + 11, 18, C.lime);
    }
    // tužka v ruce (zkrácená ruka)
    const handPos = seg(t, 1.5, 2.8);
    const hx = paperX + 50 + handPos * 30; const hy = paperY - 10;
    ctx.strokeStyle = C.orange; ctx.lineWidth = 2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(paperX + 80, GROUND - 30); ctx.lineTo(hx, hy); ctx.stroke();
    ctx.fillStyle = C.orange; ctx.beginPath(); ctx.arc(hx, hy, 3, 0, Math.PI * 2); ctx.fill();
    blondeHair(ctx, 150, GROUND - 40, 16, C.blond);
    circle(ctx, 150, GROUND - 40, 14, C.blond, true);
    ctx.fillStyle = '#0b0f1a'; ctx.beginPath(); ctx.arc(150, GROUND - 40, 3.5, 0, Math.PI * 2); ctx.fill();
    box(ctx, 140, GROUND - 70, 30, 60, C.cyan, 3);
    limb(ctx, [150, GROUND - 40], [hx + 5, hy], 5, C.cyan);
    ctx.fillStyle = '#666'; txt(ctx, 'psaní na papír', 250, GROUND - 10, 10, C.dim);

    // --- POZICE 2: papír se hodí na zem ---
    if (t > 5.5) {
      const fallP = ease(seg(t, 5.5, 6.5));
      ctx.save(); ctx.globalAlpha = A * fallP;
      const crumpledX = STAGE_W - 80 - seg(t, 5.5, 6.5) * 60;
      const crumpledY = GROUND - 100 - seg(t, 5.5, 6.5) * 80;
      ctx.fillStyle = '#fff'; ctx.beginPath();
      ctx.moveTo(crumpledX, crumpledY); ctx.lineTo(crumpledX + 30, crumpledY + 10);
      ctx.lineTo(crumpledX + 15, crumpledY + 25); ctx.lineTo(crumpledX - 15, crumpledY + 25);
      ctx.lineTo(crumpledX - 30, crumpledY + 10); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#000'; ctx.font = 'bold 11px ' + MONO; ctx.textAlign = 'center';
      ctx.fillText('snad jsem tě netrefila, sry', crumpledX + 15, crumpledY + 35);
      ctx.restore();
    }

    // --- POZICE 3: další stránka, další psaní ---
    if (t > 7) {
      const writeP = ease(seg(t, 7, 8));
      box(ctx, STAGE_W - 220, GROUND - 30, 180, 30, '#fdfdfd', 3);
      ctx.fillStyle = C.lime; txt(ctx, 'další stránka...', STAGE_W - 110, GROUND - 18, 12, C.lime);
      const newShown = Math.ceil(seg(t, 7, 8) * 6);
      if (newShown > 0) {
        ctx.fillStyle = C.lime; txt(ctx, 'další nápad sliced'.slice(0, newShown), STAGE_W - 150, GROUND - 10, 14, C.lime);
      }
    }
    ctx.globalAlpha = 1;
  }
};

// přiřazení scen k globálnímu objektu
SCENES.firma = firma; SCENES.doom = doom; SCENES.napad = napad; SCENES.dcera = dcera; SCENES.armada = armada; SCENES.slozite = slozite;
document.querySelectorAll('figure.article-scene[data-scene]').forEach(initFigure);