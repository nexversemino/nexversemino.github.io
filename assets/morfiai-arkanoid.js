// Morfiai — Arkanoid mini-game on the hero section.
// Runs automatically while the page is at the top (scrollY < 60). Stops
// permanently as soon as the user scrolls down or clicks a CTA.
//
// Canvas is absolutely positioned over the hero section and has
// pointer-events:none, so the page stays fully clickable.
//
// Controls: mouse move (desktop) or touch (mobile) moves the paddle.

(() => {
  'use strict';

  const HERO_SEL = '.nex-dragon-video-section';
  const hero = document.querySelector(HERO_SEL);
  if (!hero) return;

  // Respect reduced motion.
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

  const BRICKS = { cols: 8, rows: 6, margin: 6, top: 0.18, h: 0.022 };
  let bricks = [];
  function buildBricks() {
    bricks = [];
    const bw = (W - BRICKS.margin * (BRICKS.cols + 1)) / BRICKS.cols;
    const bh = Math.max(14, H * BRICKS.h);
    const top = H * BRICKS.top;
    for (let r = 0; r < BRICKS.rows; r++) {
      for (let c = 0; c < BRICKS.cols; c++) {
        bricks.push({
          x: BRICKS.margin + c * (bw + BRICKS.margin),
          y: top + r * (bh + BRICKS.margin),
          w: bw, h: bh,
          color: COLORS[(r + c) % COLORS.length],
          alive: true,
        });
      }
    }
  }
  buildBricks();

  // Paddle
  const paddle = { w: 90, h: 10, y: 0, x: 0 };
  function resetPaddle() { paddle.y = H - 60; paddle.x = W / 2 - paddle.w / 2; }
  resetPaddle();

  // Ball
  const ball = { x: W / 2, y: H * 0.55, r: 6, vx: 260, vy: -300 };
  let running = true;
  let score = 0;
  let stopped = false;
  let last = performance.now();

  // Input
  let targetX = W / 2;
  function setTarget(cx) {
    const r = hero.getBoundingClientRect();
    targetX = clamp(cx - r.left, paddle.w / 2, W - paddle.w / 2);
  }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  window.addEventListener('mousemove', e => { setTarget(e.clientX); }, { passive: true });
  window.addEventListener('touchmove', e => {
    if (e.touches[0]) setTarget(e.touches[0].clientX);
  }, { passive: true });
  window.addEventListener('touchstart', e => {
    if (e.touches[0]) setTarget(e.touches[0].clientX);
  }, { passive: true });

  function stop() {
    if (stopped) return;
    stopped = true;
    running = false;
    canvas.style.opacity = '0';
    canvas.style.transition = 'opacity .4s ease';
    setTimeout(() => { canvas.remove(); }, 450);
  }

  // Stop when user scrolls or clicks a CTA
  let scrollLock = false;
  window.addEventListener('scroll', () => {
    if (window.scrollY > 60 && !stopped) stop();
  }, { passive: true });
  hero.querySelectorAll('a, button').forEach(el => {
    el.addEventListener('click', () => stop(), { passive: true });
  });

  function update(dt) {
    if (!running) return;
    // paddle follows target smoothly
    const want = targetX - paddle.w / 2;
    paddle.x += (want - paddle.x) * Math.min(1, dt * 12);
    paddle.x = clamp(paddle.x, 4, W - paddle.w - 4);

    // ball
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    // walls
    if (ball.x - ball.r < 0) { ball.x = ball.r; ball.vx = Math.abs(ball.vx); }
    if (ball.x + ball.r > W) { ball.x = W - ball.r; ball.vx = -Math.abs(ball.vx); }
    if (ball.y - ball.r < 0) { ball.y = ball.r; ball.vy = Math.abs(ball.vy); }

    // paddle
    if (ball.vy > 0 && ball.y + ball.r >= paddle.y && ball.y + ball.r <= paddle.y + paddle.h + 6 &&
        ball.x >= paddle.x - ball.r && ball.x <= paddle.x + paddle.w + ball.r) {
      ball.y = paddle.y - ball.r;
      const hit = (ball.x - (paddle.x + paddle.w / 2)) / (paddle.w / 2);
      const speed = Math.hypot(ball.vx, ball.vy);
      const ang = hit * 0.85; // -0.85..0.85 radians-ish offset
      ball.vx = speed * Math.sin(ang);
      ball.vy = -Math.abs(speed * Math.cos(ang));
      // keep a minimum upward speed
      if (ball.vy > -120) ball.vy = -120;
    }

    // bricks
    for (const b of bricks) {
      if (!b.alive) continue;
      if (ball.x + ball.r > b.x && ball.x - ball.r < b.x + b.w &&
          ball.y + ball.r > b.y && ball.y - ball.r < b.y + b.h) {
        b.alive = false;
        score += 10;
        // decide which side was hit
        const dx = (ball.x - (b.x + b.w / 2)) / (b.w / 2);
        const dy = (ball.y - (b.y + b.h / 2)) / (b.h / 2);
        if (Math.abs(dx) > Math.abs(dy)) ball.vx = -ball.vx; else ball.vy = -ball.vy;
        // speed up slightly
        const sp = Math.hypot(ball.vx, ball.vy);
        const nsp = Math.min(520, sp * 1.015);
        const f = nsp / sp;
        ball.vx *= f; ball.vy *= f;
      }
    }

    // if all bricks cleared, rebuild
    if (bricks.every(b => !b.alive)) {
      buildBricks();
      ball.vx *= 1.05; ball.vy *= 1.05;
    }

    // ball lost
    if (ball.y - ball.r > H) {
      // reset ball
      ball.x = W / 2; ball.y = H * 0.55;
      ball.vx = 260 * (Math.random() > 0.5 ? 1 : -1);
      ball.vy = -300;
    }
  }

  function draw() {
    if (!running) return;
    ctx.clearRect(0, 0, W, H);

    // Bricks
    for (const b of bricks) {
      if (!b.alive) continue;
      // glow
      ctx.shadowColor = b.color;
      ctx.shadowBlur = 12;
      ctx.fillStyle = b.color;
      ctx.globalAlpha = 0.85;
      const r = 4;
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
      // inner highlight
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fillRect(b.x + 2, b.y + 2, b.w - 4, 2);
    }

    // Paddle
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

    // Ball
    ctx.shadowColor = '#fff';
    ctx.shadowBlur = 16;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Score
    ctx.font = 'bold 14px "JetBrains Mono", monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.textAlign = 'left';
    ctx.fillText(`ARKANOID · ${score}`, 14, 26);
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillText('scrollem dolů hru ukončíš', 14, 42);
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

  // If the hero scrolls out of view, also stop (backup)
  const io = new IntersectionObserver(entries => {
    if (!entries[0].isIntersecting && !stopped) stop();
  }, { threshold: 0.3 });
  io.observe(hero);
})();
