// Morfiai — Arkanoid mini-game on the hero section.
// Paddle follows the mouse; bricks descend from the top; power-ups drop.
// Auto-starts while page is at top (scrollY < 60); stops on scroll/CTA click.

(() => {
  'use strict';
  const hero = document.querySelector('.nex-dragon-video-section');
  if (!hero) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const canvas = document.createElement('canvas');
  canvas.id = 'morfiai-arkanoid';
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;z-index:3;pointer-events:none;';
  hero.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  let W = 0, H = 0, dpr = 1;
  function resize() {
    const r = hero.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.max(1, Math.round(r.width));
    H = Math.max(1, Math.round(r.height));
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  window.addEventListener('resize', resize);

  const COLORS = ['#00e5ff','#ff1fd0','#8b2dff','#ff8a00','#7dff00','#ffd400'];
  const POWERUPS = ['big','small','hopik','life','speed','slow'];
  const POWERUP_COLORS = { big:'#7dff00', small:'#ff1fd0', hopik:'#ffd400', life:'#ff8a00', speed:'#00e5ff', slow:'#8b2dff' };
  const POWERUP_LABELS = { big:'BIG', small:'SMALL', hopik:'+10', life:'+1UP', speed:'FAST', slow:'SLOW' };

  let paddle = { x: 0, y: 0, w: 90, h: 10, targetW: 90 };
  let ball = { x: 0, y: 0, r: 6, vx: 200, vy: -260 };
  let bricks = [];
  let powerups = [];
  let particles = [];
  let score = 0;
  let lives = 3;
  let running = true;
  let stopped = false;
  let last = performance.now();
  let targetX = 0;

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  function resetPaddle() {
    paddle.y = H - 50;
    paddle.w = 90;
    paddle.targetW = 90;
    paddle.x = W / 2 - paddle.w / 2;
  }
  function resetBall() {
    ball.x = W / 2;
    ball.y = H * 0.55;
    ball.vx = 200 * (Math.random() > 0.5 ? 1 : -1);
    ball.vy = -260;
  }
  function buildBricks() {
    bricks = [];
    const cols = 8;
    const bw = (W - 12 * (cols + 1)) / cols;
    const bh = Math.max(12, H * 0.02);
    const top = H * 0.16;
    for (let c = 0; c < cols; c++) {
      bricks.push({
        x: 12 + c * (bw + 12),
        y: top,
        w: bw, h: bh,
        color: COLORS[c % COLORS.length],
        alive: true,
        vy: 18,
      });
    }
  }
  buildBricks();
  resetPaddle();
  resetBall();
  targetX = W / 2;

  function setTarget(cx) {
    const r = hero.getBoundingClientRect();
    targetX = clamp(cx - r.left, paddle.w / 2, W - paddle.w / 2);
  }
  window.addEventListener('mousemove', e => setTarget(e.clientX), { passive: true });
  window.addEventListener('touchmove', e => { if (e.touches[0]) setTarget(e.touches[0].clientX); }, { passive: true });
  window.addEventListener('touchstart', e => { if (e.touches[0]) setTarget(e.touches[0].clientX); }, { passive: true });

  function spawnPowerup(x, y) {
    const t = POWERUPS[Math.floor(Math.random() * POWERUPS.length)];
    powerups.push({ x, y, w: 26, h: 16, vy: 120, type: t, alive: true });
  }

  function applyPowerup(type) {
    switch (type) {
      case 'big': paddle.targetW = Math.min(160, paddle.targetW + 30); break;
      case 'small': paddle.targetW = Math.max(50, paddle.targetW - 25); break;
      case 'hopik': score += 10; break;
      case 'life': lives = Math.min(5, lives + 1); break;
      case 'speed':
        ball.vx *= 1.2; ball.vy *= 1.2;
        if (Math.hypot(ball.vx, ball.vy) > 600) { const f = 600 / Math.hypot(ball.vx, ball.vy); ball.vx *= f; ball.vy *= f; }
        break;
      case 'slow':
        ball.vx *= 0.75; ball.vy *= 0.75;
        if (Math.hypot(ball.vx, ball.vy) < 120) { const f = 120 / Math.hypot(ball.vx, ball.vy); ball.vx *= f; ball.vy *= f; }
        break;
    }
    for (let i = 0; i < 12; i++) {
      particles.push({
        x: ball.x, y: ball.y,
        vx: (Math.random() - 0.5) * 200,
        vy: (Math.random() - 0.5) * 200,
        life: 0.5, color: POWERUP_COLORS[type],
      });
    }
  }

  function stop() {
    if (stopped) return;
    stopped = true;
    running = false;
    canvas.style.opacity = '0';
    canvas.style.transition = 'opacity .4s ease';
    setTimeout(() => canvas.remove(), 450);
  }

  window.addEventListener('scroll', () => {
    if (window.scrollY > 60 && !stopped) stop();
  }, { passive: true });
  hero.querySelectorAll('a, button').forEach(el => {
    el.addEventListener('click', () => stop(), { passive: true });
  });

  const io = new IntersectionObserver(entries => {
    if (!entries[0].isIntersecting && !stopped) stop();
  }, { threshold: 0.3 });
  io.observe(hero);

  function update(dt) {
    if (!running) return;

    const want = targetX - paddle.w / 2;
    paddle.x += (want - paddle.x) * Math.min(1, dt * 14);
    paddle.w += (paddle.targetW - paddle.w) * Math.min(1, dt * 6);
    paddle.x = clamp(paddle.x, 4, W - paddle.w - 4);

    for (const b of bricks) {
      if (!b.alive) continue;
      b.y += b.vy * dt;
      if (b.y + b.h > H - 80) b.vy = 0;
    }

    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    if (ball.x - ball.r < 0) { ball.x = ball.r; ball.vx = Math.abs(ball.vx); }
    if (ball.x + ball.r > W) { ball.x = W - ball.r; ball.vx = -Math.abs(ball.vx); }
    if (ball.y - ball.r < 0) { ball.y = ball.r; ball.vy = Math.abs(ball.vy); }

    if (ball.vy > 0 && ball.y + ball.r >= paddle.y && ball.y + ball.r <= paddle.y + paddle.h + 8 &&
        ball.x >= paddle.x - ball.r && ball.x <= paddle.x + paddle.w + ball.r) {
      ball.y = paddle.y - ball.r;
      const hit = (ball.x - (paddle.x + paddle.w / 2)) / (paddle.w / 2);
      const speed = Math.hypot(ball.vx, ball.vy);
      ball.vx = speed * Math.sin(hit * 0.9);
      ball.vy = -Math.abs(speed * Math.cos(hit * 0.9));
      if (ball.vy > -100) ball.vy = -100;
    }

    for (const b of bricks) {
      if (!b.alive) continue;
      if (ball.x + ball.r > b.x && ball.x - ball.r < b.x + b.w &&
          ball.y + ball.r > b.y && ball.y - ball.r < b.y + b.h) {
        b.alive = false;
        score += 5;
        const dx = (ball.x - (b.x + b.w / 2)) / (b.w / 2);
        const dy = (ball.y - (b.y + b.h / 2)) / (b.h / 2);
        if (Math.abs(dx) > Math.abs(dy)) ball.vx = -ball.vx; else ball.vy = -ball.vy;
        if (Math.random() < 0.3) spawnPowerup(b.x + b.w / 2, b.y + b.h);
        for (let i = 0; i < 8; i++) {
          particles.push({ x: ball.x, y: ball.y, vx: (Math.random()-0.5)*160, vy: (Math.random()-0.5)*160, life: 0.4, color: b.color });
        }
      }
    }

    if (bricks.length && bricks.every(b => !b.alive)) buildBricks();

    for (const pu of powerups) {
      if (!pu.alive) continue;
      pu.y += pu.vy * dt;
      if (pu.y + pu.h >= paddle.y && pu.y <= paddle.y + paddle.h &&
          pu.x + pu.w / 2 >= paddle.x && pu.x - pu.w / 2 <= paddle.x + paddle.w) {
        pu.alive = false;
        applyPowerup(pu.type);
      }
      if (pu.y > H) pu.alive = false;
    }
    powerups = powerups.filter(p => p.alive);

    for (const pt of particles) {
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.life -= dt;
      pt.vx *= 0.95; pt.vy *= 0.95;
    }
    particles = particles.filter(p => p.life > 0);

    if (ball.y - ball.r > H) {
      lives--;
      if (lives <= 0) {
        score = 0; lives = 3;
        buildBricks(); resetPaddle(); resetBall();
      } else {
        resetBall();
      }
    }
  }

  function draw() {
    if (!running) return;
    ctx.clearRect(0, 0, W, H);

    for (const b of bricks) {
      if (!b.alive) continue;
      ctx.shadowColor = b.color;
      ctx.shadowBlur = 10;
      ctx.fillStyle = b.color;
      ctx.globalAlpha = 0.7;
      const r = 3;
      ctx.beginPath();
      ctx.moveTo(b.x + r, b.y);
      ctx.arcTo(b.x + b.w, b.y, b.x + b.w, b.y + b.h, r);
      ctx.arcTo(b.x + b.w, b.y + b.h, b.x, b.y + b.h, r);
      ctx.arcTo(b.x, b.y + b.h, b.x, b.y, r);
      ctx.arcTo(b.x, b.y, b.x + b.w, b.y, r);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.fillRect(b.x + 2, b.y + 2, b.w - 4, 2);
    }

    for (const pu of powerups) {
      if (!pu.alive) continue;
      const c = POWERUP_COLORS[pu.type];
      ctx.shadowColor = c;
      ctx.shadowBlur = 12;
      ctx.fillStyle = c;
      ctx.globalAlpha = 0.9;
      const r = 4;
      ctx.beginPath();
      ctx.moveTo(pu.x - pu.w/2 + r, pu.y);
      ctx.arcTo(pu.x + pu.w/2, pu.y, pu.x + pu.w/2, pu.y + pu.h, r);
      ctx.arcTo(pu.x + pu.w/2, pu.y + pu.h, pu.x - pu.w/2, pu.y + pu.h, r);
      ctx.arcTo(pu.x - pu.w/2, pu.y + pu.h, pu.x - pu.w/2, pu.y, r);
      ctx.arcTo(pu.x - pu.w/2, pu.y, pu.x + pu.w/2, pu.y, r);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#0a0a14';
      ctx.font = 'bold 9px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(POWERUP_LABELS[pu.type], pu.x, pu.y + pu.h / 2);
    }

    const pg = ctx.createLinearGradient(paddle.x, 0, paddle.x + paddle.w, 0);
    pg.addColorStop(0, '#00e5ff');
    pg.addColorStop(1, '#ff1fd0');
    ctx.shadowColor = '#00e5ff';
    ctx.shadowBlur = 14;
    ctx.fillStyle = pg;
    const pr = 5;
    ctx.beginPath();
    ctx.moveTo(paddle.x + pr, paddle.y);
    ctx.arcTo(paddle.x + paddle.w, paddle.y, paddle.x + paddle.w, paddle.y + paddle.h, pr);
    ctx.arcTo(paddle.x + paddle.w, paddle.y + paddle.h, paddle.x, paddle.y + paddle.h, pr);
    ctx.arcTo(paddle.x, paddle.y + paddle.h, paddle.x, paddle.y, pr);
    ctx.arcTo(paddle.x, paddle.y, paddle.x + paddle.w, paddle.y, pr);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.shadowColor = '#fff';
    ctx.shadowBlur = 16;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    for (const pt of particles) {
      ctx.globalAlpha = Math.max(0, pt.life * 2);
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    ctx.font = 'bold 14px "JetBrains Mono", monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(`ARKANOID \u00b7 ${score}`, 14, 26);
    ctx.font = '11px "JetBrains Mono", monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillText(`\u2665 ${lives}   scrollem dol\u016f hru ukon\u010d\u00ed\u0161`, 14, 42);
  }

  function loop(now) {
    if (stopped) return;
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
