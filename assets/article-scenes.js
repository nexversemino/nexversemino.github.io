/* Animated story scenes for the "Firma, kter+Ì se napsala sama" article.
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

function gear(ctx, x, y, r, color, rot) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.fillStyle = color;
  for (let i = 0; i < 8; i++) {
    ctx.save();
    ctx.rotate((i * Math.PI) / 4);
    ctx.fillRect(r - 3, -4, 8, 8);
    ctx.restore();
  }
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.38, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function critter(ctx, x, y, s, color, phase) {
  const bob = Math.sin(phase * 6) * 2;
  ctx.save();
  ctx.translate(x, y + bob);
  // legs
  line(ctx, -s * 0.4, 0, -s * 0.4 + Math.sin(phase * 12) * 4, s * 0.5, 3, color);
  line(ctx, s * 0.4, 0, s * 0.4 - Math.sin(phase * 12) * 4, s * 0.5, 3, color);
  // body
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(0, -s * 0.6, s * 0.7, s * 0.6, 0, 0, Math.PI * 2);
  ctx.fill();
  // ears
  ctx.beginPath();
  ctx.moveTo(-s * 0.5, -s * 1.05);
  ctx.lineTo(-s * 0.25, -s * 1.6);
  ctx.lineTo(-s * 0.05, -s * 1.1);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(s * 0.5, -s * 1.05);
  ctx.lineTo(s * 0.25, -s * 1.6);
  ctx.lineTo(s * 0.05, -s * 1.1);
  ctx.closePath();
  ctx.fill();
  // eyes
  ctx.fillStyle = '#0b0f1a';
  ctx.beginPath();
  ctx.arc(-s * 0.25, -s * 0.7, Math.max(1.4, s * 0.12), 0, Math.PI * 2);
  ctx.arc(s * 0.25, -s * 0.7, Math.max(1.4, s * 0.12), 0, Math.PI * 2);
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
    circle(ctx, head[0], head[1], headR, col, true);
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

const firmaDesk = { x: 452, w: 118, top: 168 };

function drawDesk(ctx) {
  const d = firmaDesk;
  box(ctx, d.x, d.top, d.w, 7, 'rgba(255,255,255,.5)', 2);
  box(ctx, d.x + 6, d.top + 7, 6, GROUND - d.top - 7, 'rgba(255,255,255,.32)', 2);
  box(ctx, d.x + d.w - 12, d.top + 7, 6, GROUND - d.top - 7, 'rgba(255,255,255,.32)', 2);
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
  dur: 7,
  draw(ctx, t) {
    const A = seg(t, 0, 0.4);
    ctx.globalAlpha = A;
    skyline(ctx);
    ground(ctx);
    drawDesk(ctx);

    // paper on the desk
    const paper = [firmaDesk.x + 8, firmaDesk.top - 11, 46, 11];
    box(ctx, paper[0], paper[1], paper[2], paper[3], 'rgba(255,255,255,.88)', 2);

    // walking in, then writing
    const walkEnd = 2.4;
    const walking = t < walkEnd;
    const px = walking ? lerp(-34, 440, ease(seg(t, 0, walkEnd))) : 440;
    const lean = walking ? 0.06 : lerp(0.06, 0.34, seg(t, walkEnd, walkEnd + 0.6));
    const swing = t * 9;

    // writing hand over the paper
    const wt = seg(t, 3.0, 5.8);
    const hx = lerp(462, 496, wt) + Math.sin(wt * 42) * 2.5;
    const hy = 156 + Math.sin(wt * 42) * 2.5;
    const handF = walking
      ? [px + 12 + Math.sin(swing) * 7, 150 + Math.cos(swing) * 5]
      : t < 3.0
        ? [lerp(px + 14, hx, seg(t, 2.6, 3.0)), lerp(152, hy, seg(t, 2.6, 3.0))]
        : [hx, hy];

    const anchors = person(ctx, {
      x: px, y: GROUND, h: 84, facing: 1, color: C.cyan, head: 'house',
      lean: lean, legPhase: walking ? swing : null, armF: handF,
      alpha: A
    });

    // pencil in the writing hand
    if (t >= 2.9) {
      const p = seg(t, 2.9, 3.2);
      ctx.globalAlpha = A * p;
      line(ctx, handF[0] + 3, handF[1] - 6, handF[0] + 6, handF[1] + 7, 3, C.orange);
      line(ctx, handF[0] + 6, handF[1] + 7, handF[0] + 7, handF[1] + 10, 2, '#2b2f3a');
      ctx.globalAlpha = A;
    }

    // "firma" written above the house-head
    const label = 'firma';
    const shown = Math.ceil(seg(t, 0.9, 2.1) * label.length);
    if (shown > 0) {
      ctx.globalAlpha = A * seg(t, 0.9, 1.3);
      txt(ctx, label.slice(0, shown), anchors.head[0], anchors.head[1] - 46, 20, C.lime);
      ctx.globalAlpha = A;
    }

    // ink appears on the paper while he writes
    inkLine(ctx, paper[0] + 5, paper[1] + 3.5, 36, seg(t, 3.2, 4.1), 'rgba(20,24,34,.85)');
    inkLine(ctx, paper[0] + 5, paper[1] + 7.5, 36, seg(t, 4.2, 5.2), 'rgba(20,24,34,.85)');

    // check mark pops when the page is done
    if (t > 5.8) {
      const s = back(seg(t, 5.8, 6.2));
      ctx.globalAlpha = A * seg(t, 5.8, 6.0);
      ctx.strokeStyle = C.lime;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(512, 158);
      ctx.lineTo(517, 163);
      ctx.lineTo(526, 152);
      ctx.stroke();
      ctx.globalAlpha = A;
      void s;
    }

    // proud straightening at the end
    if (t > 6.2) {
      const p = ease(seg(t, 6.2, 6.6));
      ctx.globalAlpha = A;
      heart(ctx, 420, 120 - p * 4, 10 + p * 5, C.pink);
    }
    ctx.globalAlpha = 1;
  }
};

/* ---------- scene: doom ---------- */

const doom = {
  dur: 6.5,
  draw(ctx, t) {
    const A = seg(t, 0, 0.4);
    ctx.globalAlpha = A;
    skyline(ctx);
    ground(ctx);

    // desk
    box(ctx, 300, 168, 300, 7, 'rgba(255,255,255,.5)', 2);
    box(ctx, 306, 175, 6, GROUND - 175, 'rgba(255,255,255,.32)', 2);
    box(ctx, 588, 175, 6, GROUND - 175, 'rgba(255,255,255,.32)', 2);

    // stool
    box(ctx, 196, 168, 46, 6, 'rgba(255,255,255,.45)', 2);
    box(ctx, 216, 174, 6, GROUND - 174, 'rgba(255,255,255,.3)', 2);

    // monitor
    const on = t > 3.2;
    box(ctx, 470, 96, 120, 66, 'rgba(255,255,255,.55)', 5);
    box(ctx, 476, 102, 108, 54, on ? '#26080c' : '#12151d', 3);
    box(ctx, 522, 162, 16, 6, 'rgba(255,255,255,.5)', 2);
    if (on) {
      // flames along the bottom of the screen
      for (let i = 0; i < 9; i++) {
        const fx = 481 + i * 12;
        const fh = 6 + Math.abs(Math.sin(t * 9 + i * 1.7)) * 12;
        ctx.fillStyle = i % 2 ? C.orange : C.pink;
        ctx.beginPath();
        ctx.moveTo(fx, 156);
        ctx.lineTo(fx + 5, 156 - fh);
        ctx.lineTo(fx + 10, 156);
        ctx.closePath();
        ctx.fill();
      }
      // DOOM letters type themselves in
      const letters = Math.ceil(seg(t, 3.4, 4.3) * 4);
      txt(ctx, 'DOOM'.slice(0, letters), 530, 118, 20, C.lime);
      // little imp bouncing
      if (t > 4.4) {
        const ix = 530 + Math.sin(t * 3) * 34;
        const iy = 142 - Math.abs(Math.sin(t * 5)) * 20;
        critter(ctx, ix, iy, 7, C.orange, t);
      }
    } else {
      txt(ctx, '...', 530, 130, 16, 'rgba(255,255,255,.25)');
    }

    // reclining figure: feet up on the desk
    const lift = ease(seg(t, 0.6, 1.6));
    const footX = lerp(258, 336, lift);
    const footY = lerp(GROUND, 160, lift);
    const wig = t > 4.6 ? Math.sin(t * 6) * 5 : 0;
    const hip = [218, 164];
    const lean = lerp(0.05, -0.3, lift);
    const sh = [hip[0] + Math.sin(lean) * 28, hip[1] - Math.cos(lean) * 28];
    const headR = 11;
    const head = [sh[0] + Math.sin(lean) * 14, sh[1] - Math.cos(lean) * 14];
    const w = 5;

    // legs (one over the other)
    ctx.globalAlpha = A * 0.6;
    limb(ctx, hip[0], hip[1], footX - 6, footY + 4, 62, 52, -1, w, C.cyan);
    ctx.globalAlpha = A;
    limb(ctx, hip[0], hip[1], footX, footY + wig * 0.3, 62, 52, -1, w, C.cyan);
    // shoes
    circle(ctx, footX + 6, footY + wig * 0.3, 5, C.pink, true);
    circle(ctx, footX, footY + 5, 5, C.pink, true);

    // torso + head
    line(ctx, hip[0], hip[1], sh[0], sh[1], w * 1.15, C.cyan);
    circle(ctx, head[0], head[1], headR, C.cyan, true);
    ctx.fillStyle = '#0b0f1a';
    ctx.beginPath();
    ctx.arc(head[0] + 5, head[1] - 1, 2.4, 0, Math.PI * 2);
    ctx.fill();
    // chill sunglasses
    line(ctx, head[0] + 1, head[1] - 3, head[0] + 10, head[1] - 3, 2.5, '#0b0f1a');

    // coffee: rests on the desk, lifts to the mouth for a sip
    const sip1 = seg(t, 1.8, 2.5);
    const sip2 = seg(t, 3.6, 4.1);
    const down = seg(t, 2.9, 3.4);
    let cupX = lerp(360, head[0] + 16, sip1 * (1 - down) + sip2 * (1 - down) * 0);
    let cupY = lerp(158, head[1] + 4, sip1 * (1 - down));
    if (t > 3.6) {
      const p = seg(t, 3.6, 4.1) * (1 - seg(t, 4.6, 5.1));
      cupX = lerp(360, head[0] + 16, p);
      cupY = lerp(158, head[1] + 4, p);
    }
    const armHand = [cupX - 2, cupY + 4];
    limb(ctx, sh[0], sh[1], armHand[0], armHand[1], 20, 20, 1, w, C.cyan);
    // second arm propping him up
    limb(ctx, sh[0], sh[1], 186, 158, 20, 20, 1, w, C.cyan);

    // cup + steam
    box(ctx, cupX - 6, cupY - 6, 13, 12, C.lime, 2);
    box(ctx, cupX + 7, cupY - 4, 4, 6, C.lime, 2);
    if ((cupY < 140) || t > 5.2) {
      ctx.strokeStyle = 'rgba(255,255,255,.5)';
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 2; i++) {
        ctx.beginPath();
        const sx = cupX - 2 + i * 5;
        ctx.moveTo(sx, cupY - 9);
        ctx.quadraticCurveTo(sx + 3, cupY - 15, sx, cupY - 21);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }
};

/* ---------- scene: napad ---------- */

const BULBS = [
  [300, 66], [168, 96], [432, 88], [240, 150], [372, 152],
  [92, 156], [516, 138], [520, 62], [378, 40], [214, 42], [76, 62]
];

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

const napad = {
  dur: 6.5,
  draw(ctx, t) {
    const A = seg(t, 0, 0.4);
    ctx.globalAlpha = A;
    skyline(ctx);
    ground(ctx);

    // watcher on the left reacts to every new idea
    const pops = BULBS.map((_, i) => 0.6 + i * 0.5);
    let jump = 0;
    pops.forEach((p) => {
      if (t > p && t < p + 0.45) jump = Math.max(jump, Math.sin(seg(t, p, p + 0.45) * Math.PI) * 7);
    });
    person(ctx, {
      x: 54, y: GROUND - jump, h: 74, facing: 1, color: C.pink,
      lean: 0.04 + jump * 0.01,
      armF: [96, 132 - jump], armB: [88, 128 - jump], alpha: A
    });

    // ideas multiplying
    BULBS.forEach(([x, y], i) => {
      const p0 = pops[i];
      if (t < p0) return;
      const s = back(seg(t, p0, p0 + 0.5));
      const pulse = 0.6 + 0.4 * Math.sin(t * 4 + i);
      const r = 13 * s;
      const color = [C.lime, C.cyan, C.orange, C.pink][i % 4];
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(s, s);
      ctx.translate(-x, -y);
      bulb(ctx, x, y, r, color, pulse * s);
      ctx.restore();
      if (i === 0) txt(ctx, '!', x, y - 30, 18, C.lime);
    });
    ctx.globalAlpha = 1;
  }
};

/* ---------- scene: dcera ---------- */

const dcera = {
  dur: 6.5,
  draw(ctx, t) {
    const A = seg(t, 0, 0.4);
    ctx.globalAlpha = A;
    skyline(ctx);
    ground(ctx);

    // mom's workstation
    box(ctx, 60, 172, 92, 7, 'rgba(255,255,255,.5)', 2);
    box(ctx, 66, 179, 6, GROUND - 179, 'rgba(255,255,255,.32)', 2);
    box(ctx, 140, 179, 6, GROUND - 179, 'rgba(255,255,255,.32)', 2);
    box(ctx, 74, 166, 62, 6, 'rgba(255,255,255,.55)', 2);
    box(ctx, 78, 138, 54, 28, 'rgba(255,255,255,.55)', 3);
    box(ctx, 82, 142, 46, 20, '#101728', 2);
    if (t > 0.5) {
      const caret = Math.floor(t * 3) % 2 === 0;
      box(ctx, 86, 148, 22, 3, C.cyan, 1);
      if (caret) box(ctx, 110, 146, 3, 7, C.cyan, 1);
    }

    // toys on the right so the room feels lived in
    box(ctx, 400, GROUND - 14, 14, 14, C.violet, 2);
    box(ctx, 416, GROUND - 10, 10, 10, C.orange, 2);
    circle(ctx, 452, GROUND - 7, 7, C.pink, true);

    // mom typing
    const type = Math.sin(t * 9) * 3;
    const pull = ease(seg(t, 3.0, 4.0)) * (1 - seg(t, 5.0, 5.4));
    const momLean = 0.05 - pull * 0.09 * (1 + Math.sin(t * 7) * 0.5);
    const momX = t > 5.2 ? lerp(40, 85, ease(seg(t, 5.2, 5.9))) : 40;
    const mom = person(ctx, {
      x: momX, y: GROUND, h: 88, facing: 1, color: C.pink,
      lean: momLean,
      legPhase: t > 5.2 && t < 5.9 ? t * 10 : null,
      armF: [lerp(momX + 34, 96, pull) + (pull ? 0 : type * 0.4), lerp(166, 160, pull) + (pull ? Math.sin(t * 8) * 3 : 0)],
      armB: [momX + 44, 168 - type * 0.5],
      alpha: A
    });

    // daughter runs in from the right, then tugs mom's arm
    const run = seg(t, 1.3, 3.0);
    const dx = lerp(560, 118, ease(run));
    const running = t > 1.3 && t < 3.0;
    const dSh = [dx - Math.sin(0.05) * 18, (GROUND - 54 * 0.44) - Math.cos(0.05) * 18];
    const tugP = ease(seg(t, 3.0, 3.6)) * (1 - seg(t, 4.9, 5.3));
    person(ctx, {
      x: dx, y: GROUND, h: 54, facing: -1, color: C.lime,
      lean: tugP ? -0.08 - Math.sin(t * 8) * 0.05 : 0.05,
      legPhase: running ? t * 11 : null,
      armF: tugP ? [mom.handF[0] + 6, mom.handF[1] + 2] : [dx - 22, GROUND - 54 * 0.5],
      armB: [dx + 16, GROUND - 54 * 0.5],
      alpha: A
    });
    void dSh;

    // speech bubble
    if (t > 4.1) {
      const s = back(seg(t, 4.1, 4.5));
      ctx.save();
      ctx.translate(178, 104);
      ctx.scale(s, s);
      const bw = 108;
      const bh = 30;
      box(ctx, -bw / 2, -bh / 2, bw, bh, C.white, 8);
      ctx.fillStyle = C.white;
      ctx.beginPath();
      ctx.moveTo(-bw / 2 + 14, bh / 2 - 2);
      ctx.lineTo(-bw / 2 + 6, bh / 2 + 12);
      ctx.lineTo(-bw / 2 + 30, bh / 2 - 2);
      ctx.closePath();
      ctx.fill();
      txt(ctx, 'J+¸ CHCI TAKY!', 0, 1, 12, '#141a26');
      ctx.restore();
    }

    // mom reaches out to pat her head, heart pops
    if (t > 5.9) {
      const s = back(seg(t, 5.9, 6.3));
      ctx.globalAlpha = A * seg(t, 5.9, 6.1);
      heart(ctx, 150, 118 - s * 4, 11 * s, C.pink);
      ctx.globalAlpha = A;
    }
    void mom;
    ctx.globalAlpha = 1;
  }
};

/* ---------- scene: armada ---------- */

function robot(ctx, x, phase, salute, alpha) {
  const w = 44;
  const h = 54;
  const top = GROUND - h;
  ctx.save();
  ctx.globalAlpha = alpha;
  // legs
  const lp = phase;
  limb(ctx, x, top + h * 0.6, x - 10 + Math.sin(lp) * 8, GROUND, 12, 12, -1, 5, C.violet);
  limb(ctx, x, top + h * 0.6, x + 10 - Math.sin(lp) * 8, GROUND, 12, 12, -1, 5, C.violet);
  // body
  box(ctx, x - w / 2, top + 8, w, h * 0.55, C.violet, 6);
  box(ctx, x - w / 2 + 6, top + 14, w - 12, 8, 'rgba(11,15,26,.6)', 2);
  // head
  box(ctx, x - 13, top - 6, 26, 18, C.violet, 4);
  box(ctx, x - 8, top, 16, 5, C.cyan, 2);
  // antenna
  line(ctx, x, top - 6, x, top - 16, 2, 'rgba(255,255,255,.6)');
  circle(ctx, x, top - 18, 3.5, C.pink, true);
  // arms
  if (salute > 0.5) {
    limb(ctx, x + w / 2 - 4, top + 14, x + 6, top - 4, 14, 14, 1, 5, C.violet);
    limb(ctx, x - w / 2 + 4, top + 14, x - 14, top + 34, 14, 14, -1, 5, C.violet);
  } else {
    limb(ctx, x + w / 2 - 4, top + 14, x + 20, top + 40, 14, 14, 1, 5, C.violet);
    limb(ctx, x - w / 2 + 4, top + 14, x - 20, top + 40, 14, 14, -1, 5, C.violet);
  }
  ctx.restore();
}

const armada = {
  dur: 6.5,
  draw(ctx, t) {
    const A = seg(t, 0, 0.4);
    ctx.globalAlpha = A;
    skyline(ctx);
    ground(ctx);

    // five robots marching into formation
    for (let i = 0; i < 5; i++) {
      const target = 120 + i * 95;
      const start = -70;
      const t0 = 0.2 + i * 0.3;
      const p = ease(seg(t, t0, t0 + 1.5));
      const x = lerp(start, target, p);
      const walking = p > 0 && p < 1;
      const saluteT = 4.3 + i * 0.18;
      const salute = t > saluteT ? 1 : 0;
      const blink = t > 5.4 ? 0.7 + 0.3 * Math.sin(t * 8 + i) : 1;
      robot(ctx, x, walking ? t * 8 + i : 0, salute, A * blink);
      void saluteT;
    }

    // general inspecting from the right
    const gx = lerp(612, 566, ease(seg(t, 2.6, 3.9)));
    const gWalk = t > 2.6 && t < 3.9;
    const pointing = t > 3.9;
    person(ctx, {
      x: gx, y: GROUND, h: 84, facing: -1, color: C.orange,
      lean: pointing ? -0.06 : 0.03,
      legPhase: gWalk ? t * 10 : null,
      armF: pointing ? [gx - 40, GROUND - 66] : [gx - 18, GROUND - 40],
      armB: [gx + 16, GROUND - 38],
      alpha: A
    });
    // cap
    const gsh = [gx - Math.sin(-0.06) * 0, GROUND - 84 * 0.78];
    box(ctx, gx - 13, GROUND - 84 * 0.78 - 26, 26, 7, C.orange, 3);
    box(ctx, gx - (gx > 580 ? 13 : 13) - 8, GROUND - 84 * 0.78 - 21, 14, 4, C.orange, 2);
    void gsh;

    // salute order ticks above the robots
    if (t > 4.3 && t < 5.6) {
      for (let i = 0; i < 5; i++) {
        const st = 4.3 + i * 0.18;
        if (t > st) {
          txt(ctx, '‘ùÙ', 120 + i * 95, 44, 16, C.lime);
        }
      }
    }
    ctx.globalAlpha = 1;
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
    txt(ctx, 'jednoduch+Ø', 84, 152, 9, 'rgba(255,255,255,.55)');

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

    // observer watching it all make (no) sense
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
    if (!r.width || !r.height || r.width > 10000 || r.height > 10000) return false;
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

  window.addEventListener('resize', () => paint(t));
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => paint(t));
  }
}

document.querySelectorAll('figure.article-scene[data-scene]').forEach(initFigure);
