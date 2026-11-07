/* Animated story scenes for the "Firma, která se napsala sama" article.
   Each scene is a deterministic canvas mini-animation that plays once when the
   reader scrolls it into view. Clicking (or pressing Enter) replays it. */

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
  dim: 'rgba(255,255,255,.28)'
};
const MONO = '"JetBrains Mono",ui-monospace,SFMono-Regular,Menlo,monospace';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, p) => a + (b - a) * p;
const seg = (t, a, b) => clamp((t - a) / (b - a || 1), 0, 1);
const ease = (p) => p * p * (3 - 2 * p);
const easeOut = (p) => 1 - (1 - p) * (1 - p);
const back = (p) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2);
};

/* ---------- primitives ---------- */

function line(ctx, x1, y1, x2, y2, w, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function circle(ctx, x, y, r, color, fill) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  if (fill) {
    ctx.fillStyle = color;
    ctx.fill();
  } else {
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(2, r * 0.16);
    ctx.stroke();
  }
}

function box(ctx, x, y, w, h, color, r) {
  r = Math.min(r || 0, w / 2, h / 2);
  ctx.fillStyle = color;
  ctx.beginPath();
  if (!r) {
    ctx.rect(x, y, w, h);
  } else {
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
  }
  ctx.closePath();
  ctx.fill();
}

function strokeBox(ctx, x, y, w, h, r, color, lw) {
  r = Math.min(r || 0, w / 2, h / 2);
  ctx.strokeStyle = color;
  ctx.lineWidth = lw || 2;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.stroke();
}

function txt(ctx, s, x, y, size, color, align, weight) {
  ctx.font = (weight || '700') + ' ' + size + 'px ' + MONO;
  ctx.fillStyle = color;
  ctx.textAlign = align || 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(s, x, y);
}

/* Two-segment IK (law of cosines): joint position between start and target. */
function ik(x1, y1, x2, y2, l1, l2, bend) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const n = Math.hypot(dx, dy) || 1e-6;
  const d = Math.min(n, l1 + l2 - 0.01);
  const ux = dx / n;
  const uy = dy / n;
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  return [x1 + ux * a - uy * h * bend, y1 + uy * a + ux * h * bend];
}

function limb(ctx, x1, y1, x2, y2, l1, l2, bend, w, color) {
  const distance = Math.hypot(x2 - x1, y2 - y1);
  const reach = Math.min(1, (l1 + l2 - 0.01) / (distance || 1));
  x2 = lerp(x1, x2, reach);
  y2 = lerp(y1, y2, reach);
  const j = ik(x1, y1, x2, y2, l1, l2, bend);
  line(ctx, x1, y1, j[0], j[1], w, color);
  line(ctx, j[0], j[1], x2, y2, w, color);
  return j;
}

/* ---------- shared scenery ---------- */

const SKYLINE = [
  [10, 46, 60], [64, 34, 42], [104, 52, 78], [162, 30, 50], [198, 44, 66],
  [250, 38, 44], [296, 56, 84], [358, 34, 54], [398, 42, 62], [448, 36, 46],
  [490, 54, 76], [550, 32, 52], [590, 44, 64]
];

function skyline(ctx) {
  for (const [x, w, h] of SKYLINE) {
    box(ctx, x, GROUND - h, w, h, 'rgba(255,255,255,.045)', 3);
    for (let r = 0; r < Math.floor((h - 10) / 15); r++) {
      for (let c = 0; c < Math.floor((w - 8) / 13); c++) {
        if ((x * 0.5 + r * 3 + c * 5) % 7 < 3) {
          box(ctx, x + 6 + c * 13, GROUND - h + 8 + r * 15, 5, 7, 'rgba(255,255,255,.07)', 1);
        }
      }
    }
  }
}

function ground(ctx) {
  line(ctx, 20, GROUND, STAGE_W - 20, GROUND, 2, 'rgba(255,255,255,.22)');
}

function glow(ctx, x, y, r, color, alpha) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.save();
  ctx.globalAlpha = alpha == null ? 0.5 : alpha;
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function heart(ctx, x, y, s, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s / 16, s / 16);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, 6);
  ctx.bezierCurveTo(-12, -3, -7, -12, 0, -6);
  ctx.bezierCurveTo(7, -12, 12, -3, 0, 6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function blonde(ctx, x, y, r, facing, sway = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(facing, 1);
  const gold = ctx.createLinearGradient(-r, 0, r, 0);
  gold.addColorStop(0, '#c58732');
  gold.addColorStop(.48, '#fff1a5');
  gold.addColorStop(1, '#edbb5d');
  ctx.fillStyle = gold;
  ctx.beginPath();
  ctx.moveTo(r * .8, -r * .55);
  ctx.bezierCurveTo(r * .4, -r * 1.55, -r * 1.35, -r * 1.25, -r * 1.25, 0);
  ctx.bezierCurveTo(-r * 1.2, r, -r * .8, r * 2, -r * 1.55 + sway, r * 2.9);
  ctx.bezierCurveTo(-r * .1 + sway, r * 2.7, -r * .35, r * 1.5, -r * .25, 0);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/* ---------- stick figure ---------- */

/* Draws a stick person standing at (x, groundY). Returns joint anchors so a
   scene can attach props (pencil, cup, label) to the figure. */
function person(ctx, o) {
  const h = o.h || 80;
  const x = o.x;
  const y = o.y;
  const f = o.facing || 1;
  const col = o.color || C.cyan;
  const limbC = o.limbColor || col;
  const w = o.limbW || Math.max(3, h * 0.055);
  const lean = o.lean || 0;
  const hip = [x, y - h * 0.44];
  const torsoL = h * 0.34;
  const sh = [hip[0] + Math.sin(lean) * torsoL, hip[1] - Math.cos(lean) * torsoL];
  const headR = h * 0.13;
  const head = [sh[0] + Math.sin(lean) * h * 0.17, sh[1] - Math.cos(lean) * h * 0.17];
  const armU = h * 0.23;
  const armL = h * 0.23;
  const legU = h * 0.23;
  const legL = h * 0.23;
  const A = o.alpha == null ? 1 : o.alpha;

  // feet
  const step = o.step == null ? 12 : o.step;
  const stance = o.stance == null ? 8 : o.stance;
  let feet;
  if (o.legPhase == null) {
    feet = [[x + f * stance, y], [x - f * stance * 0.7, y]];
  } else {
    const p = o.legPhase;
    feet = [
      [x + Math.sin(p) * step * f, y - Math.max(0, Math.cos(p)) * 8],
      [x + Math.sin(p + Math.PI) * step * f, y - Math.max(0, Math.cos(p + Math.PI)) * 8]
    ];
  }

  const handF = o.armF || [sh[0] + f * 10, sh[1] + armU + armL - 6];
  const handB = o.armB || [sh[0] - f * 8, sh[1] + armU + armL - 10];
  const kb = f > 0 ? -1 : 1;
  const eb = o.armBend == null ? (f > 0 ? 1 : -1) : o.armBend;

  // back limbs (dimmer)
  const saveA = ctx.globalAlpha;
  ctx.globalAlpha = A * 0.55;
  limb(ctx, hip[0], hip[1], feet[1][0], feet[1][1], legU, legL, kb, w, limbC);
  limb(ctx, sh[0], sh[1], handB[0], handB[1], armU, armL, eb, w, limbC);
  // torso
  ctx.globalAlpha = A;
  line(ctx, hip[0], hip[1], sh[0], sh[1], w * 1.15, col);
  // front limbs
  limb(ctx, hip[0], hip[1], feet[0][0], feet[0][1], legU, legL, kb, w, limbC);
  limb(ctx, sh[0], sh[1], handF[0], handF[1], armU, armL, eb, w, limbC);

  // head
  if (o.head === 'house') {
    buildingHead(ctx, head[0], head[1] + headR, headR * 2.6, col, C.lime);
  } else {
    blonde(ctx, ...head, headR, f, Math.sin(o.legPhase || 0) * 3);
    circle(ctx, head[0], head[1], headR * .83, col, true);
    // visor / eye on the facing side
    ctx.fillStyle = '#0b0f1a';
    ctx.beginPath();
    ctx.arc(head[0] + f * headR * 0.4, head[1] - headR * 0.1, Math.max(1.4, headR * 0.22), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = saveA;
  return { hip, sh, head, headR, handF, handB, feet };
}

/* Building used as a head: the "firma" has a house for a brain. */
function buildingHead(ctx, cx, baseY, s, color, win) {
  const w = s * 0.72;
  const x = cx - w / 2;
  const y = baseY - s;
  box(ctx, x, y, w, s, color, 2);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x - 4, y + 1);
  ctx.lineTo(cx, y - s * 0.32);
  ctx.lineTo(x + w + 4, y + 1);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = win;
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 2; c++) {
      ctx.fillRect(x + w * 0.18 + c * w * 0.42, y + s * 0.34 + r * s * 0.3, w * 0.2, s * 0.16);
    }
  }
}

/* ---------- scene: firma ---------- */

function desk(ctx, x, w, top) {
  box(ctx, x, top, w, 6, '#82909c', 2);
  box(ctx, x + 5, top + 6, 5, GROUND - top - 6, '#536171', 2);
  box(ctx, x + w - 10, top + 6, 5, GROUND - top - 6, '#536171', 2);
}

function inkLine(ctx, x, y, w, prog, color) {
  if (prog <= 0) return;
  const n = Math.max(2, Math.floor(26 * prog));
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const u = (i / 26);
    const px = x + u * w;
    const py = y + Math.sin(u * 20) * 1.6;
    if (i) ctx.lineTo(px, py);
    else ctx.moveTo(px, py);
  }
  ctx.stroke();
}

const firma = {
  dur: 10.4,
  draw(ctx, t) {
    skyline(ctx);
    ground(ctx);
    desk(ctx, 300, 130, 168);
    const walking = t < 1.6;
    const x = lerp(-28, 284, ease(seg(t, 0, 1.6)));
    const second = t >= 4.5;
    const writing = seg(t, second ? 4.5 : 1.7, second ? 6.5 : 3.65);
    const drop = ease(seg(t, 3.7, 4.5));
    const crumple = ease(seg(t, 6.5, 7.3));
    const throwPaper = ease(seg(t, 7.55, 8.25));
    const hand = walking ? undefined : t >= 8.25 ? [304 + 24 * seg(t, 8.25, 10), 155 + Math.sin(t * 25) * 2] : [
      lerp(304 + writing * 22, 298, crumple) + Math.sin(t * 24) * (1 - crumple),
      lerp(155 + 2 * Math.sin(t * 24), 137, crumple)
    ];
    person(ctx, { x, y: GROUND, h: 86, lean: .21, legPhase: walking ? t * 13 : null,
      armF: hand, armB: crumple > 0 && throwPaper < 1 ? [292, 138] : undefined });
    if (hand && (crumple === 0 || t >= 8.25)) line(ctx, hand[0], hand[1] - 5, hand[0] + 4, hand[1] + 6, 3, C.orange);

    function sheet(x, y, angle, progress) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      box(ctx, -19, -6, 38, 12, C.white, 2);
      inkLine(ctx, -15, -2, 30, seg(progress, 0, .5), '#586787');
      inkLine(ctx, -15, 3, 30, seg(progress, .5, 1), '#586787');
      ctx.restore();
    }
    if (t > 1.55) sheet(322 + drop * 120, 161 + drop * 44, drop * 3.1, second ? 1 : writing);
    if (second && crumple < 1) {
      sheet(lerp(322, 298, crumple), lerp(161, 137, crumple), crumple, writing);
    }
    if (crumple > 0 && throwPaper < 1) {
      const bx = lerp(298, 340, throwPaper);
      const by = 137 - Math.sin(throwPaper * Math.PI) * 32;
      const r = (5 + crumple * 4) * (1 + throwPaper * 13);
      ctx.save();
      ctx.globalAlpha = 1 - seg(throwPaper, .8, 1);
      ctx.translate(bx, by);
      ctx.rotate(throwPaper * 5);
      ctx.fillStyle = C.white;
      ctx.beginPath();
      for (let i = 0; i < 12; i++) {
        const a = i * Math.PI / 6;
        const edge = r * (i % 2 ? .78 : 1);
        ctx.lineTo(Math.cos(a) * edge, Math.sin(a) * edge);
      }
      ctx.closePath();
      ctx.fill();
      line(ctx, -r * .6, -r * .4, r * .25, r * .6, 2, '#9aacc4');
      ctx.restore();
    }
    if (t >= 8.25) {
      sheet(320, 161, 0, seg(t, 8.25, 10));
      const message = 'Snad jsem tě netrefila, sry';
      txt(ctx, message.slice(0, Math.ceil(message.length * seg(t, 8.35, 10))), 320, 61, 22, C.white);
      line(ctx, 150, 81, 150 + 340 * seg(t, 8.35, 10), 81, 2, C.cyan);
    }
  }
};

const doomArt = new Image();
doomArt.src = new URL('./article-doom.jpg', import.meta.url);

const doom = {
  dur: 8,
  draw(ctx, t) {
    skyline(ctx);
    ground(ctx);
    desk(ctx, 235, 326, 168);
    box(ctx, 193, 168, 46, 7, '#82909c', 3);
    box(ctx, 210, 175, 7, 37, '#536171', 2);
    const progress = seg(t, .55, 5.4);
    box(ctx, 344, 48, 209, 111, '#788797', 6);
    box(ctx, 350, 54, 197, 99, '#181725', 3);
    if (doomArt.complete && doomArt.naturalWidth) ctx.drawImage(doomArt, 350, 54, 197, 93);
    box(ctx, 350, 125, 197, 28, '#12141e', 2);
    txt(ctx, progress < 1 ? 'NAČÍTÁM… ' + Math.floor(progress * 100) + ' %' : 'PŘIPRAVENO HRÁT', 449, 135, 12, C.white);
    box(ctx, 361, 145, 175, 4, '#454859', 2);
    box(ctx, 361, 145, progress * 175, 4, C.orange, 2);
    box(ctx, 436, 159, 25, 9, '#788797', 2);

    const lift = ease(seg(t, .35, 1.45));
    const hip = [218, 165];
    const shoulder = [lerp(224, 209, lift), 137];
    const head = [shoulder[0] - 4, 123];
    const foot = [lerp(240, 273, lift), lerp(207, 162, lift)];
    limb(ctx, ...hip, foot[0] - 7, foot[1] + 3, 29, 28, -1, 5, '#267f9a');
    limb(ctx, ...hip, ...foot, 29, 28, -1, 5, C.cyan);
    line(ctx, ...foot, foot[0] + 8, foot[1] + 3, 7, C.pink);
    line(ctx, ...hip, ...shoulder, 7, C.cyan);
    blonde(ctx, ...head, 12, 1);
    circle(ctx, ...head, 10, C.cyan, true);
    line(ctx, head[0] + 1, 121, head[0] + 9, 121, 3, '#101728');

    const sip = ease(seg(t, 2.3, 3.1)) * (1 - ease(seg(t, 4.8, 5.6)));
    const cup = [lerp(244, head[0] + 15, sip), lerp(161, 126, sip)];
    limb(ctx, ...shoulder, cup[0] - 3, cup[1] + 4, 21, 20, 1, 5, C.cyan);
    ctx.save();
    ctx.translate(...cup);
    ctx.rotate(-sip * .22);
    strokeBox(ctx, 4, -4, 7, 8, 3, C.lime);
    box(ctx, -6, -6, 13, 13, C.lime, 3);
    for (let i = 0; i < 3; i++) {
      const rise = (t * 12 + i * 7) % 22;
      ctx.globalAlpha = 1 - rise / 22;
      line(ctx, i * 3 - 3, -8 - rise, i * 3 - 1 + Math.sin(t * 4 + i), -13 - rise, 1.3, C.white);
    }
    ctx.restore();
  }
};

/* ---------- scene: napad ---------- */

function bulb(ctx, x, y, r, color, on) {
  if (on > 0.05) glow(ctx, x, y, r * 2.6, color, 0.32 * on);
  circle(ctx, x, y, r, color, true);
  // filament
  ctx.strokeStyle = '#0b0f1a';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(x - 3, y + 2);
  ctx.lineTo(x - 1, y - 3);
  ctx.lineTo(x + 1, y + 2);
  ctx.lineTo(x + 3, y - 3);
  ctx.stroke();
  // base
  box(ctx, x - 4, y + r - 1, 8, 6, 'rgba(255,255,255,.65)', 1);
  // rays
  if (on > 0.4) {
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3 + 0.3;
      line(ctx, x + Math.cos(a) * (r + 4), y + Math.sin(a) * (r + 4),
        x + Math.cos(a) * (r + 9), y + Math.sin(a) * (r + 9), 2, color);
    }
  }
}

const PRODUCTS = [
  ['Hra', 'game'], ['Webovka', 'web'], ['E-shop', 'shop'], ['Nákupní asistent', 'assistant'],
  ['Android', 'robot'], ['Telefon', 'phone'], ['Hračky', 'toy'], ['Panáček s kloboukem', 'hat']
];

function productIcon(ctx, type, color) {
  if (type === 'game') {
    box(ctx, -19, -9, 38, 19, color, 8);
    line(ctx, -13, 0, -5, 0, 2, '#121729');
    line(ctx, -9, -4, -9, 4, 2, '#121729');
    circle(ctx, 9, 0, 3, '#121729', true);
  } else if (type === 'web' || type === 'shop') {
    strokeBox(ctx, -19, -13, 38, 26, 4, color);
    box(ctx, -19, -13, 38, 6, color, 2);
    for (let i = 0; i < 3; i++) box(ctx, -14 + i * 10, -3, 8, 10, color, 2);
    if (type === 'shop') box(ctx, -22, -8, 44, 6, C.orange, 2);
  } else if (type === 'phone') {
    strokeBox(ctx, -9, -15, 18, 30, 4, color);
    box(ctx, -5, -9, 10, 16, color, 2);
    circle(ctx, 0, 11, 1.5, color, true);
  } else if (type === 'toy') {
    box(ctx, -15, 0, 16, 13, color, 3);
    box(ctx, 2, -5, 15, 18, C.pink, 3);
    circle(ctx, -5, -7, 6, C.orange, true);
  } else {
    box(ctx, -14, -9, 28, 18, color, 5);
    circle(ctx, -6, 0, 2, '#121729', true);
    circle(ctx, 6, 0, 2, '#121729', true);
    if (type === 'hat') {
      box(ctx, -9, -18, 18, 10, C.orange, 2);
      box(ctx, -18, -10, 36, 4, C.orange, 2);
    } else {
      line(ctx, 0, -8, 0, -16, 2, color);
      circle(ctx, 0, -16, 2.5, color, true);
      if (type === 'assistant') box(ctx, -17, 12, 34, 4, color, 2);
    }
  }
}

const napad = {
  dur: 8,
  draw(ctx, t) {
    skyline(ctx);
    ground(ctx);
    const wave = Math.sin(t * 7) * (1 - seg(t, 6.2, 7));
    person(ctx, { x: 54, y: GROUND, h: 84, color: C.pink,
      armF: [82, 130 + wave * 7], armB: [63, 157] });
    PRODUCTS.forEach(([name, type], i) => {
      const start = .3 + i * .62;
      if (t <= start) return;
      const x = 157 + (i % 4) * 131;
      const y = 64 + Math.floor(i / 4) * 94;
      const change = seg(t, start + .55, start + 1.06);
      const color = [C.lime, C.cyan, C.orange, C.pink][i % 4];
      ctx.save();
      ctx.translate(x, y);
      if (change < 1) {
        ctx.globalAlpha = seg(t, start, start + .15) * (1 - change);
        bulb(ctx, 0, 0, 12, color, 1);
      }
      if (change > 0) {
        ctx.globalAlpha = change;
        ctx.scale(back(change), back(change));
        box(ctx, -62, -26, 124, 66, '#181d32', 8);
        strokeBox(ctx, -62, -26, 124, 66, 8, color, 1.2);
        productIcon(ctx, type, color);
        txt(ctx, name, 0, 27, name.length > 17 ? 10 : 12, C.white);
      }
      ctx.restore();
    });
  }
};

function workstation(ctx, x, top, color, t, active) {
  desk(ctx, x, 106, top);
  box(ctx, x + 29, top - 49, 65, 37, '#82909c', 4);
  box(ctx, x + 33, top - 45, 57, 29, '#101728', 2);
  box(ctx, x + 59, top - 12, 7, 12, '#82909c', 2);
  box(ctx, x + 10, top - 4, 35, 4, color, 2);
  for (let i = 0; i < 3; i++) {
    const width = active ? 10 + ((Math.floor(t * 7) + i * 9) % 36) : 8;
    box(ctx, x + 39, top - 39 + i * 7, width, 2, color, 1);
  }
}

const dcera = {
  dur: 8,
  draw(ctx, t) {
    skyline(ctx);
    ground(ctx);
    workstation(ctx, 166, 172, C.pink, t, true);
    person(ctx, { x: 144, y: GROUND, h: 90, color: C.pink, lean: .16,
      armF: [178, 165 + Math.sin(t * 16) * 2], armB: [173, 164 - Math.sin(t * 16) * 2] });

    const arrive = ease(seg(t, .45, 2.1));
    const fetch = ease(seg(t, 3.1, 4.2));
    const slide = ease(seg(t, 4.2, 5.9));
    const deskX = lerp(652, 367, slide);
    const daughterX = t < 4.2 ? lerp(lerp(670, 319, arrive), 616, fetch) : deskX - 36;
    const moving = (arrive > 0 && arrive < 1) || (fetch > 0 && fetch < 1) || (slide > 0 && slide < 1);
    const typing = t >= 5.9;
    workstation(ctx, deskX, 177, C.lime, t, typing);
    person(ctx, { x: daughterX, y: GROUND, h: 73, color: C.lime,
      facing: t < 3.1 ? -1 : 1, lean: t < 3.1 ? -.14 : .25,
      legPhase: moving ? t * 14 : null,
      armF: t >= 4.2 ? [daughterX + (typing ? 45 : 36), 174 + (typing ? Math.sin(t * 18) * 2 : 0)] : undefined });
    if (t > 2 && t < 3.2) {
      box(ctx, 256, 73, 126, 34, C.white, 8);
      line(ctx, 314, 105, 318, 114, 5, C.white);
      txt(ctx, 'Já chci taky!', 319, 91, 14, '#141a26');
    }
    if (typing) heart(ctx, 307, 112, 15 * back(seg(t, 5.9, 6.4)), C.pink);
  }
};

/* ---------- scene: armada ---------- */

function robot(ctx, x, phase, salute, alpha, color) {
  const w = 44;
  const h = 54;
  const top = GROUND - h;
  ctx.save();
  ctx.globalAlpha = alpha;
  // legs
  const lp = phase;
  limb(ctx, x, top + h * 0.6, x - 10 + Math.sin(lp) * 8, GROUND, 12, 12, -1, 5, color);
  limb(ctx, x, top + h * 0.6, x + 10 - Math.sin(lp) * 8, GROUND, 12, 12, -1, 5, color);
  // body
  box(ctx, x - w / 2, top + 8, w, h * 0.55, color, 6);
  box(ctx, x - w / 2 + 6, top + 14, w - 12, 8, 'rgba(11,15,26,.6)', 2);
  // head
  box(ctx, x - 13, top - 6, 26, 18, color, 4);
  box(ctx, x - 8, top, 16, 5, C.cyan, 2);
  // antenna
  line(ctx, x, top - 6, x, top - 16, 2, 'rgba(255,255,255,.6)');
  circle(ctx, x, top - 18, 3.5, C.pink, true);
  // arms
  if (salute > 0.5) {
    limb(ctx, x + w / 2 - 4, top + 14, x + 6, top - 4, 14, 14, 1, 5, color);
    limb(ctx, x - w / 2 + 4, top + 14, x - 14, top + 34, 14, 14, -1, 5, color);
  } else {
    limb(ctx, x + w / 2 - 4, top + 14, x + 20, top + 40, 14, 14, 1, 5, color);
    limb(ctx, x - w / 2 + 4, top + 14, x - 20, top + 40, 14, 14, -1, 5, color);
  }
  ctx.restore();
}

const AGENTS = ['Qwen', 'Gemma', 'Pi', 'Codex', 'Claude', 'Hermes', 'DeepSeek', 'Argon', 'Gemini', 'Nemotron'];

const armada = {
  dur: 7.2,
  draw(ctx, t) {
    skyline(ctx);
    ground(ctx);
    AGENTS.forEach((name, i) => {
      const rank = Math.floor(i / 5);
      const p = ease(seg(t, .25 + i * .21, 1.6 + i * .21));
      const x = lerp(-42, 58 + (i % 5) * 99, p);
      const color = [C.violet, C.cyan, C.lime, C.pink, C.orange][i % 5];
      const salute = seg(t, 4.4 + i * .12, 4.7 + i * .12);
      ctx.save();
      ctx.translate(0, rank ? 0 : -91);
      robot(ctx, x, p > 0 && p < 1 ? t * 14 + i : 0, salute, p, color);
      ctx.globalAlpha = p;
      txt(ctx, name, x, 124, 14, C.white);
      ctx.restore();
    });

    const x = lerp(667, 575, ease(seg(t, 2.6, 4)));
    const pose = ease(seg(t, 4, 4.5));
    const general = person(ctx, { x, y: GROUND - 4, h: 94, facing: -1, color: '#cc5268',
      lean: -.06, legPhase: t > 2.6 && t < 4 ? t * 12 : null,
      armF: [x - lerp(19, 43, pose), lerp(164, 141, pose)] });
    const [sx, sy] = general.sh;
    const [hx, hy] = general.hip;
    box(ctx, sx - 12, sy - 2, 23, hy - sy + 8, '#85354e', 4);
    line(ctx, sx - 12, sy, sx - 4, sy, 4, '#ffda8d');
    line(ctx, sx + 4, sy, sx + 11, sy, 4, '#ffda8d');
    line(ctx, sx - 8, sy + 3, hx + 6, hy - 3, 3, '#ffda8d');
    box(ctx, hx - 11, hy - 3, 23, 5, '#211627', 1);
    general.feet.forEach(([fx, fy]) => {
      line(ctx, fx + 3, fy - 3, fx - 8, fy + 2, 4, C.pink);
      line(ctx, fx + 3, fy - 2, fx + 3, fy + 3, 2, C.pink);
    });
    box(ctx, general.head[0] - 13, general.head[1] - 15, 25, 8, '#85354e', 3);
    box(ctx, general.head[0] - 17, general.head[1] - 9, 29, 3, '#ffda8d', 1);
  }
};

/* ---------- scene: slozite ---------- */

function tanglePath(cx, cy, n) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const u = i / n;
    const a = u * Math.PI * 7;
    const r = 30 + 16 * Math.sin(u * 9.7) + 9 * Math.cos(u * 5.3);
    pts.push([cx + Math.cos(a) * r * 1.3, cy + Math.sin(a) * r * 0.9]);
  }
  return pts;
}
const TANGLE = tanglePath(300, 138, 240);

function apartment(ctx, x, w, h, prog, seed) {
  ctx.save();
  const top = GROUND - h;
  box(ctx, x, top, w, h, 'rgba(255,255,255,.14)', 3);
  box(ctx, x, top, w, 4, 'rgba(255,255,255,.3)', 2);
  const rows = Math.floor((h - 14) / 14);
  const cols = Math.floor((w - 10) / 13);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const lit = ((r * 7 + c * 5 + seed) % 5) < 2;
      const p = clamp(prog * rows - r, 0, 1);
      if (p <= 0) continue;
      ctx.globalAlpha = p;
      box(ctx, x + 7 + c * 13, top + 9 + r * 14, 7, 9,
        lit ? 'rgba(255,220,120,.9)' : 'rgba(255,255,255,.22)', 1);
    }
  }
  ctx.restore();
}

const slozite = {
  dur: 6.5,
  draw(ctx, t) {
    const A = seg(t, 0, 0.4);
    ctx.globalAlpha = A;
    skyline(ctx);
    ground(ctx);

    // simple input box
    box(ctx, 36, 118, 96, 46, 'rgba(255,255,255,.1)', 6);
    box(ctx, 38, 120, 92, 42, 'rgba(11,15,26,.7)', 5);
    strokeBox(ctx, 38, 120, 92, 42, 5, C.cyan, 2);
    txt(ctx, 'VSTUP', 84, 134, 13, C.cyan);
    txt(ctx, 'jednoduchý', 84, 152, 9, 'rgba(255,255,255,.55)');

    // the clean line that enters the mess
    const inP = ease(seg(t, 0.7, 1.5));
    if (inP > 0) line(ctx, 132, 141, 132 + inP * 70, 141, 3, C.cyan);

    // the tangle draws itself
    const tp = ease(seg(t, 1.5, 3.6));
    if (tp > 0) {
      const n = Math.max(2, Math.floor(TANGLE.length * tp));
      ctx.strokeStyle = C.violet;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const [px, py] = TANGLE[i];
        if (i) ctx.lineTo(px, py);
        else ctx.moveTo(px, py);
      }
      ctx.stroke();
      // a "?" of confusion grows above the mess
      if (t > 2.4) {
        const s = back(seg(t, 2.4, 2.9));
        ctx.globalAlpha = A * seg(t, 2.4, 2.7);
        txt(ctx, '?', 300, 62 - s * 4, 26 * Math.min(1, s), C.pink);
        ctx.globalAlpha = A;
      }
    }

    // exit line to the output
    const outP = ease(seg(t, 3.6, 4.0));
    if (outP > 0) line(ctx, 372, 141, 372 + outP * 48, 141, 3, C.lime);

    // the output: a block of flats
    const buildP = ease(seg(t, 4.0, 5.0));
    if (buildP > 0) {
      ctx.save();
      ctx.translate(440, GROUND);
      ctx.scale(1, buildP);
      ctx.translate(-440, -GROUND);
      apartment(ctx, 440, 52, 78, buildP * 1.4, 3);
      apartment(ctx, 500, 58, 100, buildP * 1.4, 7);
      apartment(ctx, 566, 48, 64, buildP * 1.4, 11);
      ctx.restore();
    }

    // cat and dog who live there
    if (t > 4.9) {
      const s = back(seg(t, 4.9, 5.3));
      ctx.save();
      ctx.translate(408, GROUND);
      ctx.scale(s, s);
      // cat
      ctx.fillStyle = C.pink;
      ctx.beginPath();
      ctx.ellipse(0, -9, 13, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(11, -16, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(7, -21); ctx.lineTo(8, -28); ctx.lineTo(12, -22); ctx.closePath();
      ctx.moveTo(13, -22); ctx.lineTo(16, -28); ctx.lineTo(18, -21); ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = C.pink;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(-12, -10);
      ctx.quadraticCurveTo(-22, -14, -20, -24);
      ctx.stroke();
      ctx.fillStyle = '#0b0f1a';
      ctx.beginPath();
      ctx.arc(9, -16, 1.5, 0, Math.PI * 2);
      ctx.arc(14, -16, 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    if (t > 5.2) {
      const s = back(seg(t, 5.2, 5.6));
      ctx.save();
      ctx.translate(608, GROUND);
      ctx.scale(s, s);
      // dog
      ctx.fillStyle = C.orange;
      ctx.beginPath();
      ctx.ellipse(0, -9, 12, 7.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(10, -17, 7.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(6, -21, 3, 5, -0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = C.orange;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(-11, -11);
      ctx.quadraticCurveTo(-17, -18, -14, -24);
      ctx.stroke();
      ctx.fillStyle = '#0b0f1a';
      ctx.beginPath();
      ctx.arc(12, -18, 1.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // A miniature neighborhood comes to life around the buildings.
    const reveal = ease(seg(t, 4.4, 5.7));
    ctx.save();
    ctx.globalAlpha = reveal;
    for (let i = 0; i < 7; i++) {
      const x = 396 + i * 35;
      const y = 29 + (i * 17) % 37;
      const twinkle = 3 + 2 * (1 + Math.sin(t * 6 + i));
      line(ctx, x - twinkle, y, x + twinkle, y, 1.5, '#ffda8d');
      line(ctx, x, y - twinkle, x, y + twinkle, 1.5, '#ffda8d');
    }
    for (const x of [441, 558]) {
      const drift = x + (t - 4.4) * 5;
      box(ctx, drift - 17, 81, 43, 10, '#afc5ec', 5);
      circle(ctx, drift - 3, 81, 9, '#afc5ec', true);
      circle(ctx, drift + 9, 79, 11, '#afc5ec', true);
    }
    ctx.restore();
    const walk = ease(seg(t, 5.05, 6.35));
    if (walk > 0) {
      person(ctx, { x: lerp(449, 492, walk), y: GROUND, h: 37, color: C.orange, alpha: reveal,
        legPhase: walk < 1 ? t * 12 : null });
      person(ctx, { x: lerp(581, 548, walk), y: GROUND, h: 32, color: C.pink, facing: -1,
        alpha: reveal, legPhase: walk < 1 ? t * 12 : null });
      line(ctx, 526, 185, 526, GROUND, 4, '#ad7754');
      circle(ctx, 526, 183, 11, '#84d67a', true);
      circle(ctx, 533, 177, 8, '#b9ef93', true);
    }

    // observer watching the neighborhood take shape
    person(ctx, {
      x: 176, y: GROUND, h: 74, facing: 1, color: C.cyan,
      lean: -0.04, armF: [188, GROUND - 62], armB: [166, GROUND - 40], alpha: A
    });
    ctx.globalAlpha = 1;
  }
};

const SCENES = { firma, doom, napad, dcera, armada, slozite };

/* ---------- engine ---------- */

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function initFigure(fig) {
  const scene = SCENES[fig.dataset.scene];
  const canvas = fig.querySelector('canvas');
  if (!scene || !canvas) {
    fig.remove();
    return;
  }
  const ctx = canvas.getContext('2d');
  let t = scene.dur;
  let raf = 0;
  let start = 0;
  let started = false;
  let finished = true;

  function size() {
    const r = canvas.getBoundingClientRect();
    if (!r.width) return false;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(r.width * dpr);
    const h = Math.round(r.height * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    return true;
  }

  function paint(time) {
    if (!size()) return;
    ctx.setTransform(canvas.width / STAGE_W, 0, 0, canvas.height / STAGE_H, 0, 0);
    ctx.clearRect(0, 0, STAGE_W, STAGE_H);
    scene.draw(ctx, time);
  }

  function frame(now) {
    t = Math.min(scene.dur, (now - start) / 1000);
    paint(t);
    if (t >= scene.dur) {
      raf = 0;
      playing = false;
      finished = true;
      return;
    }
    raf = requestAnimationFrame(frame);
  }

  let playing = false;

  function play() {
    if (reduced) return;
    cancelAnimationFrame(raf);
    start = performance.now();
    playing = true;
    finished = false;
    raf = requestAnimationFrame(frame);
  }

  function pause() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    playing = false;
  }

  function resume() {
    if (reduced || playing || finished || !started) return;
    start = performance.now() - t * 1000;
    playing = true;
    raf = requestAnimationFrame(frame);
  }

  function replay() {
    if (reduced) {
      paint(scene.dur);
      return;
    }
    started = true;
    play();
  }

  // static final frame for reduced motion, poster frame otherwise
  paint(scene.dur);
  if (reduced) fig.classList.add('is-in');

  fig.addEventListener('click', replay);
  fig.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      replay();
    }
  });

  if ('IntersectionObserver' in window && !reduced) {
    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.intersectionRatio >= 0.4 && !started) {
          started = true;
          fig.classList.add('is-in');
          play();
        } else if (entry.intersectionRatio === 0) {
          pause();
        } else if (entry.intersectionRatio > 0) {
          resume();
        }
      }
    }, { threshold: [0, 0.4, 0.75] });
    io.observe(fig);
  } else if (!reduced) {
    fig.classList.add('is-in');
    started = true;
  }

  if (scene === doom) doomArt.addEventListener('load', () => paint(t));
  window.addEventListener('resize', () => paint(t));
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => paint(t));
  }
}

document.querySelectorAll('figure.article-scene[data-scene]').forEach(initFigure);
