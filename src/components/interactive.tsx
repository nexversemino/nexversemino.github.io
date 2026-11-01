import { useEffect, useRef, useState, type ReactNode } from "react";

/** Vlastní kurzor ve stylu zajno: tečka + kruh s plynulým dojezdem. */
export function CustomCursor() {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const dot = dotRef.current;
    const ring = ringRef.current;
    if (!dot || !ring) return;
    let raf = 0;
    let x = -100;
    let y = -100;
    let rx = -100;
    let ry = -100;
    let hover = false;

    const onMove = (e: MouseEvent) => {
      x = e.clientX;
      y = e.clientY;
      const t = e.target as HTMLElement | null;
      hover = !!t?.closest("a, button, [data-cursor]");
    };
    const tick = () => {
      rx += (x - rx) * 0.16;
      ry += (y - ry) * 0.16;
      if (!document.documentElement.classList.contains("morfiai-game-cursor")) dot.style.transform = `translate(${x - 4}px, ${y - 4}px)`;
      const s = hover ? 1.8 : 1;
      ring.style.transform = `translate(${rx - 20}px, ${ry - 20}px) scale(${s})`;
      ring.style.borderColor = hover ? "var(--neon-pink)" : "var(--neon-cyan)";
      raf = requestAnimationFrame(tick);
    };
    window.addEventListener("mousemove", onMove);
    raf = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <>
      <div
        ref={dotRef}
        aria-hidden
        className="pointer-events-none fixed left-0 top-0 z-[100] h-2 w-2 rounded-full bg-neon-cyan"
      />
      <div
        ref={ringRef}
        aria-hidden
        className="pointer-events-none fixed left-0 top-0 z-[100] h-10 w-10 rounded-full border transition-[border-color] duration-300"
      />
    </>
  );
}

/** Magnetický prvek — přitahuje se k myši a po odjetí se vrátí. */
export function Magnetic({
  children,
  strength = 0.35,
  className = "",
}: {
  children: ReactNode;
  strength?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const onMove = (e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    el.style.transform = `translate(${dx * strength}px, ${dy * strength}px)`;
  };
  const onLeave = () => {
    const el = ref.current;
    if (el) el.style.transform = "translate(0, 0)";
  };

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className={`inline-block transition-transform duration-300 ease-out will-change-transform ${className}`}
    >
      {children}
    </div>
  );
}

/** Neonová kulička-průvodce: při rolování skočí k textu, který právě čtete
 *  (prvky s data-orb). Režimy: "bounce" (skáče po písmenech), "drop"
 *  (dopadne a odrazí se), "orbit" (krouží kolem textu). */
export function ScrollOrb() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    let x = window.innerWidth - 60;
    let y = 120;
    let current: Element | null = null;
    let since = performance.now();

    // ---- Barva: při každém odrazu si vybere novou, přechod je plynulý ----
    const NEON: Record<string, [number, number, number]> = {
      cyan: [0, 247, 248],
      pink: [255, 48, 211],
      lime: [167, 251, 15],
      orange: [255, 144, 16],
      violet: [166, 114, 255],
    };
    const KEYS = Object.keys(NEON);
    let cur: [number, number, number] = [0, 247, 248];
    let targetKey = "cyan";
    let lastPick = 0;
    const rgb = (k: string): [number, number, number] => NEON[k] ?? [0, 247, 248];
    const pickColor = (now: number) => {
      // krátká ochrana, ať se barvy nestříhají každou milisekundu
      if (now - lastPick < 180) return;
      lastPick = now;
      let k = KEYS[Math.floor(Math.random() * KEYS.length)] ?? "cyan";
      if (k === targetKey) k = KEYS[(KEYS.indexOf(k) + 1) % KEYS.length] ?? "cyan";
      targetKey = k;
    };
    const setTargetFromCss = (v: string) => {
      const key = v.match(/--neon-(\w+)/)?.[1];
      if (key && NEON[key]) targetKey = key;
    };
    const colorCss = () =>
      `rgb(${Math.round(cur[0])}, ${Math.round(cur[1])}, ${Math.round(cur[2])})`;

    const pick = () => {
      const mid = window.innerHeight / 2;
      let best: Element | null = null;
      let bestD = Infinity;
      document.querySelectorAll("[data-orb]").forEach((a) => {
        const r = a.getBoundingClientRect();
        if (r.bottom < 0 || r.top > window.innerHeight) return;
        const d = r.top < mid && r.bottom > mid ? 0 : Math.abs(r.top + r.height / 2 - mid);
        if (d < bestD && d < window.innerHeight * 0.45) {
          bestD = d;
          best = a;
        }
      });
      return best as Element | null;
    };

    // ---- Hopík na první obrazovce ----
    const R = 8;
    x = window.innerWidth - 24;
    y = 24;
    let bvx = -380;
    let bvy = 60;
    let mx = -999, my = -999, mvx = 0, mvy = 0, lastMouse = performance.now();
    const onMove = (e: MouseEvent) => {
      const t = performance.now();
      const d = Math.max(8, t - lastMouse) / 1000;
      mvx = (e.clientX - mx) / d;
      mvy = (e.clientY - my) / d;
      mx = e.clientX;
      my = e.clientY;
      lastMouse = t;
    };
    window.addEventListener("mousemove", onMove);
    let obstacles: DOMRect[] = [];
    let obstAt = 0;
    const HERO_SEL = ".wave-letter, header a, header button, section p, section a, section button, [data-bounce]";
    const CARD_SEL = "[data-bounce], header a, section h2";
    let lastSel = "";
    const collectObstacles = (now: number, sel: string) => {
      if (now - obstAt < 32 && sel === lastSel) return;
      obstAt = now;
      lastSel = sel;
      obstacles = [];
      document.querySelectorAll(sel).forEach((n) => {
        // U karty/štítku odráží vnější plocha, ne znovu její vnitřní text.
        if (n.parentElement?.closest("[data-bounce]")) return;
        const r = n.getBoundingClientRect();
        if (r.width < 4 || r.height < 4) return;
        if (r.bottom < 0 || r.top > window.innerHeight) return;
        if (r.width > window.innerWidth * 0.9) return;
        obstacles.push(r);
      });
    };
    const physics = (frame: number, now: number, sel: string) => {
      collectObstacles(now, sel);
      bvy += 900 * frame; // gravitace
      bvx *= 1 - 0.15 * frame;
      // pinkání kurzorem
      const dxm = x - mx, dym = y - my;
      const dm = Math.hypot(dxm, dym);
      if (dm < 40 && now - lastMouse < 120) {
        const nx = dxm / (dm || 1), ny = dym / (dm || 1);
        const push = 300 + Math.min(1400, Math.hypot(mvx, mvy) * 0.6);
        bvx = nx * push + mvx * 0.3;
        bvy = ny * push + mvy * 0.3 - 200;
        pickColor(now);
      }
      const sp = Math.hypot(bvx, bvy);
      if (sp > 1600) { bvx = (bvx / sp) * 1600; bvy = (bvy / sp) * 1600; }
      x += bvx * frame;
      y += bvy * frame;
      const W = window.innerWidth, H = window.innerHeight;
      if (x < R) { x = R; bvx = Math.abs(bvx) * 0.85; pickColor(now); }
      if (x > W - R) { x = W - R; bvx = -Math.abs(bvx) * 0.85; pickColor(now); }
      if (y < R) { y = R; bvy = Math.abs(bvy) * 0.85; pickColor(now); }
      if (y > H - R) {
        y = H - R;
        bvy = -Math.abs(bvy) * 0.82;
        pickColor(now);
        // ať hopík nikdy úplně neusne
        if (Math.abs(bvy) < 420) bvy = -520 - Math.random() * 200;
        if (Math.abs(bvx) < 60) bvx = (Math.random() < 0.5 ? -1 : 1) * 220;
      }
      for (const r of obstacles) {
        const cx = Math.max(r.left, Math.min(x, r.right));
        const cy = Math.max(r.top, Math.min(y, r.bottom));
        const ddx = x - cx, ddy = y - cy;
        const d2 = ddx * ddx + ddy * ddy;
        if (d2 >= R * R) continue;
        const d = Math.sqrt(d2);
        let nx: number, ny: number;
        if (d > 0.001) { nx = ddx / d; ny = ddy / d; }
        else {
          // střed uvnitř — vytlač nejkratší cestou
          const pl = x - r.left, pr = r.right - x, pt = y - r.top, pb = r.bottom - y;
          const m = Math.min(pl, pr, pt, pb);
          nx = m === pl ? -1 : m === pr ? 1 : 0;
          ny = m === pt ? -1 : m === pb ? 1 : 0;
          // Při průniku se vracíme až před hranu, nikoli o poloměr
          // od středu uvnitř prvku (to způsobovalo uváznutí).
          x = nx < 0 ? r.left : nx > 0 ? r.right : x;
          y = ny < 0 ? r.top : ny > 0 ? r.bottom : y;
        }
        x = (d > 0.001 ? cx : x) + nx * (R + 0.5);
        y = (d > 0.001 ? cy : y) + ny * (R + 0.5);
        const vn = bvx * nx + bvy * ny;
        if (vn < 0) {
          bvx -= 1.8 * vn * nx;
          bvy -= 1.8 * vn * ny;
          pickColor(now);
        }
      }
    };

    let last = performance.now();
    const tick = (now: number) => {
      // Nezávislé na obnovovací frekvenci monitoru (60/120/144 Hz).
      const frame = Math.min(0.05, (now - last) / 1000);
      last = now;
      // Arkanoid temporarily owns this exact guide node. Only one writer per frame.
      if (el.dataset.ballOwner === "arkanoid") {
        raf = requestAnimationFrame(tick);
        return;
      }
      if (el.dataset.resumeX !== undefined) {
        x = Math.max(8, Math.min(innerWidth - 8, Number(el.dataset.resumeX)));
        y = Math.max(8, Math.min(innerHeight - 8, Number(el.dataset.resumeY)));
        delete el.dataset.resumeX;
        delete el.dataset.resumeY;
        current = null;
        since = now;
      }
      const a = pick();
      const cardsMode = (a as HTMLElement | null)?.dataset["orb"] === "cards";
      if (window.scrollY < 20 || cardsMode) {
        if (cardsMode && current !== a) {
          // plynulý vstup do hopíku z průvodce
          bvx = (Math.random() < 0.5 ? -1 : 1) * 260;
          bvy = -200;
        }
        physics(frame, now, cardsMode ? CARD_SEL : HERO_SEL);
        el.style.transform = `translate(${x - 8}px, ${y - 8}px)`;
        const t = rgb(targetKey);
        cur[0] += (t[0] - cur[0]) * Math.min(1, 4 * frame);
        cur[1] += (t[1] - cur[1]) * Math.min(1, 4 * frame);
        cur[2] += (t[2] - cur[2]) * Math.min(1, 4 * frame);
        const c = colorCss();
        el.style.background = c;
        el.style.boxShadow = `0 0 20px 4px ${c}`;
        current = cardsMode ? a : null;
        raf = requestAnimationFrame(tick);
        return;
      }
      if (a !== current) {
        current = a;
        since = now;
      }
      let tx = window.innerWidth - 60;
      let ty = 120 + (window.scrollY / Math.max(1, document.documentElement.scrollHeight - window.innerHeight)) * (window.innerHeight - 240);
      // Velmi pomalý, klidný dojezd (k = rychlost za sekundu).
      // Po příletu k cíli se dojezd jen mírně zrychlí, aby stíhala animaci.
      let k = 0.9;
      if (a) {
        const r = a.getBoundingClientRect();
        const h = a as HTMLElement;
        const oc = h.dataset["orbColor"];
        if (oc) setTargetFromCss(oc);
        const dt = now - since;
        const ramp = Math.min(1, Math.max(0, (dt - 1500) / 3000));
        const mode = h.dataset["orb"];
        if (mode === "bounce") {
          const p = (dt / 4200) % 2;
          const pp = p < 1 ? p : 2 - p;
          tx = r.left + r.width * pp;
          ty = r.top - 10 - Math.abs(Math.sin(dt / 380)) * 30;
          k = 0.9 + ramp * 2.6;
        } else if (mode === "drop") {
          tx = r.left + r.width / 2;
          ty = r.top - 10 - Math.abs(Math.cos(dt / 260)) * 70 * Math.exp(-dt / 1400);
          k = 0.9 + ramp * 2.2;
        } else if (mode === "orbit") {
          const ang = dt / 1300;
          tx = r.left + r.width / 2 + Math.cos(ang) * (r.width / 2 + 30);
          ty = r.top + r.height / 2 + Math.sin(ang) * (r.height / 2 + 30);
          k = 0.9 + ramp * 2.6;
        }
      }
      const ease = 1 - Math.exp(-k * frame);
      let vx = (tx - x) * ease;
      let vy = (ty - y) * ease;
      // Strop rychlosti — kulička nikdy nepřeletí rychleji než ~500 px/s.
      const maxStep = 500 * frame;
      const len = Math.hypot(vx, vy);
      if (len > maxStep) {
        vx = (vx / len) * maxStep;
        vy = (vy / len) * maxStep;
      }
      x += vx;
      y += vy;
      const t = rgb(targetKey);
      cur[0] += (t[0] - cur[0]) * Math.min(1, 4 * frame);
      cur[1] += (t[1] - cur[1]) * Math.min(1, 4 * frame);
      cur[2] += (t[2] - cur[2]) * Math.min(1, 4 * frame);
      const c = colorCss();
      el.style.transform = `translate(${x - 8}px, ${y - 8}px)`;
      el.style.background = c;
      el.style.boxShadow = `0 0 20px 4px ${c}`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", onMove);
    };
  }, []);

  return (
    <div
      ref={ref}
      id="morfiai-guide-ball"
      data-ball-owner="guide"
      aria-hidden
      className="pointer-events-none fixed left-0 top-0 z-40 hidden h-4 w-4 rounded-full md:block"
    />
  );
}

/** Nadpis, jehož písmena se při najetí myší rozevlní vlnou. */
export function WaveText({ text, className = "" }: { text: string; className?: string }) {
  return (
    <span className={`inline-block ${className}`} aria-label={text}>
      {text.split("").map((ch, i) => (
        <span
          key={i}
          aria-hidden
          className="wave-letter inline-block transition-transform duration-300"
          style={{ transitionDelay: `${i * 25}ms` }}
        >
          {ch === " " ? "\u00A0" : ch}
        </span>
      ))}
    </span>
  );
}

/** Neonová záře, která se táhne za kurzorem po celé stránce. */
export function CursorGlow() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    let x = window.innerWidth / 2;
    let y = window.innerHeight / 2;
    let tx = x;
    let ty = y;

    const onMove = (e: MouseEvent) => {
      tx = e.clientX;
      ty = e.clientY;
    };
    const tick = () => {
      x += (tx - x) * 0.08;
      y += (ty - y) * 0.08;
      el.style.transform = `translate(${x - 160}px, ${y - 160}px)`;
      raf = requestAnimationFrame(tick);
    };
    window.addEventListener("mousemove", onMove);
    raf = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none fixed left-0 top-0 z-0 h-[320px] w-[320px] rounded-full opacity-15 blur-3xl"
      style={{
        background:
          "radial-gradient(circle, var(--neon-cyan) 0%, var(--neon-violet) 35%, transparent 70%)",
      }}
    />
  );
}

/** 3D náklon obsahu podle polohy myši uvnitř prvku (drak, karty). */
export function Tilt({
  children,
  max = 10,
  className = "",
}: {
  children: ReactNode;
  max?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const onMove = (e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `perspective(900px) rotateY(${px * max}deg) rotateX(${-py * max}deg) scale(1.02)`;
  };
  const onLeave = () => {
    const el = ref.current;
    if (el) el.style.transform = "perspective(900px) rotateY(0deg) rotateX(0deg) scale(1)";
  };

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className={`transition-transform duration-200 ease-out will-change-transform ${className}`}
    >
      {children}
    </div>
  );
}

/** Plynulé objevení při doscrollování do záběru. */
export function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setShown(true);
          obs.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={`transition-all duration-700 ease-out ${
        shown ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
      } ${className}`}
    >
      {children}
    </div>
  );
}

/** Kód, který se „píše“ sám znak po znaku, když vstoupí do záběru. */
export function Typewriter({ lines }: { lines: ReactNode[] }) {
  const ref = useRef<HTMLPreElement>(null);
  const [count, setCount] = useState(0);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setStarted(true);
          obs.disconnect();
        }
      },
      { threshold: 0.3 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!started) return;
    if (count >= lines.length) return;
    const t = setTimeout(() => setCount((c) => c + 1), count === 0 ? 300 : 420);
    return () => clearTimeout(t);
  }, [started, count, lines.length]);

  return (
    <pre ref={ref} className="whitespace-pre-wrap leading-7 text-muted-foreground">
      {lines.slice(0, count)}
      {count < lines.length && <span className="blink text-neon-cyan">▌</span>}
    </pre>
  );
}
