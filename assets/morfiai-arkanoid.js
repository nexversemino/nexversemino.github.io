// Morfiai — Arkanoid mini-game on the hero section.
// - The ball IS the page's own cursor dot (the neon-cyan kulička that follows
//   the mouse). While the game runs we drive that real element; when the game
//   pauses (scroll) we hand it back to the site's own mouse-follower.
// - Bricks are small, semi-transparent and laid out to spell MORFIAI.
// - Scrolling pauses; scrolling back to the top resumes.
// - The canvas overlay lives on document.body so React's hydration failure
//   (#418) cannot remove it.

(() => {
  'use strict';
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  let W = 0, H = 0, dpr = 1;
  let wrap, canvas, ctx;

  const NEON = ['#a672ff', '#00e5ff', '#ff1fd0', '#7dff00', '#ff8a00', '#ffd400'];
  const POWERUPS = ['big','small','hopik','life','speed','slow'];
  const PU_COLOR = { big:'#7dff00', small:'#ff1fd0', hopik:'#ffd400', life:'#ff8a00', speed:'#00e5ff', slow:'#8b2dff' };
  const PU_LABEL = { big:'BIG', small:'SMALL', hopik:'+10', life:'+1UP', speed:'FAST', slow:'SLOW' };

  let paddle = { x: 0, y: 0, w: 90, h: 9, targetW: 90 };
  let ball = { x: 0, y: 0, r: 4, vx: 200, vy: -260 };
  let bricks = [], powerups = [], particles = [];
  let score = 0, lives = 3, running = true, paused = false, last = 0, targetX = 0;

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const hero = () => document.querySelector('.nex-dragon-video-section');

  // ---- 5x5 pixel font for MORFIAI ----
  const GLYPH = {
    M: ['X...X','XX.XX','X.X.X','X...X','X...X'],
    O: ['.XXX.','X...X','X...X','X...X','.XXX.'],
    R: ['XXXX.','X...X','XXXX.','X..X.','X...X'],
    F: ['XXXXX','X....','XXX..','X....','X....'],
    I: ['XXXXX','..X..','..X..','..X..','XXXXX'],
    A: ['.XXX.','X...X','XXXXX','X...X','X...X'],
  };
  const WORD = 'MORFIAI';
  const CELL_W = 14, CELL_H = 10, GAP = 3, STEP = CELL_W + GAP;

  function buildBricks() {
    bricks = [];
    const cols = WORD.length * 5 + (WORD.length - 1);
    const totalW = cols * STEP - GAP;
    const x0 = clamp((W - totalW) / 2, 8, Math.max(8, W - totalW - 8));
    const y0 = Math.max(24, H * 0.11);
    for (let li = 0; li < WORD.length; li++) {
      const g = GLYPH[WORD[li]];
      const color = NEON[li % NEON.length];
      for (let row = 0; row < 5; row++) {
        for (let col = 0; col < 5; col++) {
          if (g[row][col] !== 'X') continue;
          bricks.push({ x: x0 + (li * 6 + col) * STEP, y: y0 + row * (CELL_H + GAP),
                        w: CELL_W, h: CELL_H, color, alive: true, vy: 14 });
        }
      }
    }
  }

  // ---- the real cursor kulička ----
  let ballEl = null;

  function findBallEl() {
    const root = document.querySelector('.min-h-screen');
    if (!root) return null;
    return Array.from(root.children).find(e => {
      const c = String(e.className || '');
      return /h-2\b/.test(c) && /w-2\b/.test(c) && /rounded-full/.test(c) && /bg-neon-cyan/.test(c);
    }) || null;
  }

  function ensureBallEl() {
    ballEl = findBallEl();
    if (!ballEl) {
      const root = document.querySelector('.min-h-screen') || document.body;
      ballEl = document.createElement('div');
      ballEl.className = 'pointer-events-none fixed left-0 top-0 z-[100] h-2 w-2 rounded-full bg-neon-cyan';
      root.appendChild(ballEl);
    }
    return ballEl;
  }

  function hijackBall() {
    const el = ensureBallEl();
    const h = hero();
    const r = h ? h.getBoundingClientRect() : { left: 0, top: 0 };
    el.style.opacity = '1';
    el.style.boxShadow = '0 0 14px 4px rgba(0,229,255,.95)';
    el.style.transform = 'translate(' + Math.round(r.left + ball.x - 4) + 'px, ' + Math.round(r.top + ball.y - 4) + 'px)';
  }

  function releaseBall() {
    if (!ballEl) return;
    ballEl.style.boxShadow = '';
    ballEl.style.opacity = '1';
    // the site's own mousemove handler resumes driving it
  }

  function mount() {
    const h = hero();
    if (!h || !running) return;
    const r = h.getBoundingClientRect();
    if (r.width < 50 || r.height < 50) return;

    W = Math.round(r.width); H = Math.round(r.height);
    dpr = Math.min(window.devicePixelRatio || 1, 2);

    wrap = document.getElementById('morfiai-arkanoid-wrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = 'morfiai-arkanoid-wrap';
      wrap.style.cssText = 'position:fixed;pointer-events:none;overflow:hidden;z-index:30;';
      document.body.appendChild(wrap);
      canvas = document.createElement('canvas');
      canvas.id = 'morfiai-arkanoid';
      canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;';
      wrap.appendChild(canvas);
    } else {
      canvas = wrap.querySelector('canvas') || canvas;
    }

    ctx = canvas.getContext('2d');
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    paddle.y = H - 50; paddle.w = 90; paddle.targetW = 90; paddle.x = W / 2 - paddle.w / 2;
    ball.x = W / 2; ball.y = H * 0.55; ball.vx = 200 * (Math.random() > 0.5 ? 1 : -1); ball.vy = -260;
    targetX = W / 2;
    buildBricks();
    last = performance.now();
  }

  function sync() {
    if (!wrap) return;
    const h = hero();
    if (!h) return;
    const r = h.getBoundingClientRect();
    if (r.width < 50) { wrap.style.display = 'none'; return; }
    wrap.style.display = 'block';
    wrap.style.left = Math.round(r.left) + 'px';
    wrap.style.top = Math.round(r.top) + 'px';
    wrap.style.width = Math.round(r.width) + 'px';
    wrap.style.height = Math.round(r.height) + 'px';
  }

  function setTarget(cx) {
    if (!W) return;
    const h = hero();
    const r = h ? h.getBoundingClientRect() : { left: 0 };
    targetX = clamp(cx - r.left, paddle.w / 2, W - paddle.w / 2);
  }
  window.addEventListener('mousemove', e => setTarget(e.clientX), { passive: true });
  window.addEventListener('touchstart', e => { if (e.touches[0]) setTarget(e.touches[0].clientX); }, { passive: true });
  window.addEventListener('touchmove', e => { if (e.touches[0]) setTarget(e.touches[0].clientX); }, { passive: true });

  function spawnPowerup(x, y) {
    powerups.push({ x, y, w: 24, h: 14, vy: 120, type: POWERUPS[(Math.random() * POWERUPS.length) | 0], alive: true });
  }

  function applyPowerup(t) {
    if (t === 'big') paddle.targetW = Math.min(150, paddle.targetW + 28);
    else if (t === 'small') paddle.targetW = Math.max(46, paddle.targetW - 24);
    else if (t === 'hopik') score += 10;
    else if (t === 'life') lives = Math.min(5, lives + 1);
    else if (t === 'speed') { ball.vx *= 1.2; ball.vy *= 1.2; const s = Math.hypot(ball.vx, ball.vy); if (s > 600) { const f = 600 / s; ball.vx *= f; ball.vy *= f; } }
    else if (t === 'slow') { ball.vx *= 0.75; ball.vy *= 0.75; const s = Math.hypot(ball.vx, ball.vy); if (s < 120) { const f = 120 / s; ball.vx *= f; ball.vy *= f; } }
    for (let i = 0; i < 12; i++) particles.push({ x: ball.x, y: ball.y, vx: (Math.random()-0.5)*200, vy: (Math.random()-0.5)*200, life: 0.5, color: PU_COLOR[t] });
  }

  // Scrolling pauses; scrolling back to the top resumes. The game never dies.
  window.addEventListener('scroll', () => { paused = window.scrollY > 60; }, { passive: true });

  function update(dt) {
    if (!running || !ctx || paused) return;

    paddle.x += (targetX - paddle.w / 2 - paddle.x) * Math.min(1, dt * 14);
    paddle.w += (paddle.targetW - paddle.w) * Math.min(1, dt * 6);
    paddle.x = clamp(paddle.x, 4, W - paddle.w - 4);

    for (const b of bricks) {
      if (!b.alive) continue;
      b.y += b.vy * dt;
      if (b.y + b.h > H - 90) b.vy = 0;
    }

    ball.x += ball.vx * dt; ball.y += ball.vy * dt;
    if (ball.x - ball.r < 0) { ball.x = ball.r; ball.vx = Math.abs(ball.vx); }
    if (ball.x + ball.r > W) { ball.x = W - ball.r; ball.vx = -Math.abs(ball.vx); }
    if (ball.y - ball.r < 0) { ball.y = ball.r; ball.vy = Math.abs(ball.vy); }

    if (ball.vy > 0 && ball.y + ball.r >= paddle.y && ball.y + ball.r <= paddle.y + paddle.h + 8 &&
        ball.x >= paddle.x - ball.r && ball.x <= paddle.x + paddle.w + ball.r) {
      ball.y = paddle.y - ball.r;
      const hit = (ball.x - (paddle.x + paddle.w / 2)) / (paddle.w / 2);
      const sp = Math.hypot(ball.vx, ball.vy);
      ball.vx = sp * Math.sin(hit * 0.9);
      ball.vy = -Math.abs(sp * Math.cos(hit * 0.9));
      if (ball.vy > -100) ball.vy = -100;
    }

    for (const b of bricks) {
      if (!b.alive) continue;
      if (ball.x + ball.r > b.x && ball.x - ball.r < b.x + b.w &&
          ball.y + ball.r > b.y && ball.y - ball.r < b.y + b.h) {
        b.alive = false; score += 5;
        const dx = (ball.x - (b.x + b.w / 2)) / (b.w / 2);
        const dy = (ball.y - (b.y + b.h / 2)) / (b.h / 2);
        if (Math.abs(dx) > Math.abs(dy)) ball.vx = -ball.vx; else ball.vy = -ball.vy;
        if (Math.random() < 0.35) spawnPowerup(b.x + b.w / 2, b.y + b.h);
        for (let i = 0; i < 8; i++) particles.push({ x: ball.x, y: ball.y, vx: (Math.random()-0.5)*160, vy: (Math.random()-0.5)*160, life: 0.4, color: b.color });
      }
    }
    if (bricks.length && bricks.every(b => !b.alive)) buildBricks();

    for (const pu of powerups) {
      if (!pu.alive) continue;
      pu.y += pu.vy * dt;
      if (pu.y + pu.h >= paddle.y && pu.y <= paddle.y + paddle.h &&
          pu.x + pu.w / 2 >= paddle.x && pu.x - pu.w / 2 <= paddle.x + paddle.w) { pu.alive = false; applyPowerup(pu.type); }
      if (pu.y > H) pu.alive = false;
    }
    powerups = powerups.filter(p => p.alive);

    for (const pt of particles) { pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.life -= dt; pt.vx *= 0.95; pt.vy *= 0.95; }
    particles = particles.filter(p => p.life > 0);

    if (ball.y - ball.r > H) {
      lives--;
      if (lives <= 0) { score = 0; lives = 3; buildBricks(); paddle.targetW = 90; paddle.w = 90; paddle.x = W / 2 - 45; }
      ball.x = W / 2; ball.y = H * 0.55; ball.vx = 200 * (Math.random() > 0.5 ? 1 : -1); ball.vy = -260;
    }
  }

  function rr(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function draw() {
    if (!running || !ctx) return;
    ctx.clearRect(0, 0, W, H);

    for (const b of bricks) {
      if (!b.alive) continue;
      ctx.shadowColor = b.color; ctx.shadowBlur = 8; ctx.fillStyle = b.color;
      ctx.globalAlpha = 0.42;
      rr(b.x, b.y, b.w, b.h, 2); ctx.fill();
      ctx.globalAlpha = 0.85;
      ctx.strokeStyle = b.color; ctx.lineWidth = 1; ctx.stroke();
      ctx.globalAlpha = 1; ctx.shadowBlur = 0;
    }

    for (const pu of powerups) {
      if (!pu.alive) continue;
      const c = PU_COLOR[pu.type];
      ctx.shadowColor = c; ctx.shadowBlur = 12; ctx.fillStyle = c; ctx.globalAlpha = 0.9;
      rr(pu.x - pu.w / 2, pu.y, pu.w, pu.h, 4); ctx.fill();
      ctx.globalAlpha = 1; ctx.shadowBlur = 0;
      ctx.fillStyle = '#0a0a14'; ctx.font = 'bold 8px "JetBrains Mono", monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(PU_LABEL[pu.type], pu.x, pu.y + pu.h / 2);
    }

    const pg = ctx.createLinearGradient(paddle.x, 0, paddle.x + paddle.w, 0);
    pg.addColorStop(0, '#00e5ff'); pg.addColorStop(1, '#ff1fd0');
    ctx.shadowColor = '#00e5ff'; ctx.shadowBlur = 12; ctx.fillStyle = pg;
    ctx.globalAlpha = 0.55;
    rr(paddle.x, paddle.y, paddle.w, paddle.h, 4); ctx.fill();
    ctx.globalAlpha = 0.9;
    ctx.strokeStyle = '#00e5ff'; ctx.lineWidth = 1; ctx.stroke();
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;

    for (const pt of particles) {
      ctx.globalAlpha = Math.max(0, pt.life * 2); ctx.fillStyle = pt.color;
      ctx.beginPath(); ctx.arc(pt.x, pt.y, 2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;

    ctx.font = 'bold 13px "JetBrains Mono", monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillText('ARKANOID \u00b7 ' + score, 14, 26);
    ctx.font = '10px "JetBrains Mono", monospace'; ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillText('\u2665 ' + lives + '   scrollem hra pauzuje, n\u00e1vrat pokra\u010duje', 14, 42);
  }

  function loop(now) {
    if (!ctx || !wrap || !wrap.isConnected) {
      ctx = null;
      mount();
      if (!ctx) { requestAnimationFrame(loop); return; }
    }
    sync();
    if (paused) releaseBall(); else hijackBall();
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  let tries = 0;
  const start = () => {
    if (ctx) return;
    mount();
    if (ctx) { sync(); last = performance.now(); requestAnimationFrame(loop); }
    else if (++tries < 200) setTimeout(start, 50);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();

  window.__arkanoid = {
    state: () => ({ paused, running, hasCtx: !!ctx, W, H, score, lives,
                    brickCount: bricks.filter(b => b.alive).length,
                    ballIsRealElement: !!(ballEl && ballEl.isConnected) }),
  };
})();
