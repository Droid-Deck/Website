(() => {
  // Spring constants come from the launcher (FocusGlide.kt, LaunchFlood.kt) so the site moves like the app.
  const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const root = document.documentElement;
  const $ = (id) => document.getElementById(id);
  const lerp = (a, b, t) => a + (b - a) * t;

  class Spring {
    constructor(x, eps = 0.3) { this.x = x; this.to = x; this.v = 0; this.z = 1; this.k = 400; this.at = 0; this.eps = eps; }
    set(to, z, k, wait = 0) { this.to = to; this.z = z; this.k = k; this.at = performance.now() + wait; }
    snap(x) { this.x = this.to = x; this.v = 0; }
    step(dt, now) {
      if (now < this.at) return true;
      const c = 2 * this.z * Math.sqrt(this.k);
      for (let left = dt; left > 0; left -= 0.004) {
        const h = Math.min(left, 0.004);
        this.v += (-this.k * (this.x - this.to) - c * this.v) * h;
        this.x += this.v * h;
      }
      if (Math.abs(this.x - this.to) < this.eps && Math.abs(this.v) < this.eps * 10) { this.x = this.to; this.v = 0; return false; }
      return true;
    }
  }

  const ticking = new Set();
  let last = 0;
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    for (const tick of [...ticking]) if (!tick(dt, now)) ticking.delete(tick);
    if (ticking.size) requestAnimationFrame(frame);
  }
  function run(tick) {
    if (ticking.has(tick)) return;
    if (!ticking.size) { last = performance.now(); requestAnimationFrame(frame); }
    ticking.add(tick);
  }

  function stepAll(springs, dt, now) {
    let alive = false;
    for (const s of springs) if (s.step(dt, now)) alive = true;
    return alive;
  }

  function glide(box) {
    const mode = box.dataset.glide;
    const items = box.dataset.glideItems;
    const inside = mode === "seg" || box.id === "links";
    const host = inside ? box : box.parentElement;
    host.classList.add("glide-host");
    const mark = document.createElement("i");
    mark.className = `glide glide-${mode}`;
    mark.setAttribute("aria-hidden", "true");
    if (inside) box.prepend(mark); else host.append(mark);
    const out = mode === "ring" ? 4 : 0;
    const edges = [0, 0, 0, 0].map(() => new Spring(0));
    let current = null;
    let shown = false;
    let lastMove = 0;
    let hovering = false;

    function rectOf(item) {
      const a = item.getBoundingClientRect();
      const b = host.getBoundingClientRect();
      return [a.left - b.left - out, a.top - b.top - out, a.right - b.left + out, a.bottom - b.top + out];
    }
    function paint() {
      const [l, t, r, b] = edges.map((s) => s.x);
      mark.style.transform = `translate(${l}px, ${t}px)`;
      mark.style.width = `${Math.max(0, r - l)}px`;
      mark.style.height = `${Math.max(0, b - t)}px`;
    }
    function tick(dt, now) {
      const alive = stepAll(edges, dt, now);
      paint();
      return alive;
    }
    function hide() {
      if (mode === "seg") return;
      current = null;
      shown = false;
      mark.classList.remove("lit");
    }
    function go(item, follow) {
      if (!item || !item.isConnected) return hide();
      const r = rectOf(item);
      mark.style.borderRadius = `${(parseFloat(getComputedStyle(item).borderTopLeftRadius) || 0) + out}px`;
      if (calm || (follow && !shown)) {
        edges.forEach((s, i) => s.snap(r[i]));
        paint();
      } else if (follow) {
        edges.forEach((s, i) => s.set(r[i], 1, 2400));
      } else if (!shown) {
        edges.forEach((s, i) => { s.snap(r[i] + (i < 2 ? -3 : 3)); s.set(r[i], 0.6, 700); });
      } else {
        const dx = (r[0] + r[2]) / 2 - (edges[0].x + edges[2].x) / 2;
        const dy = (r[1] + r[3]) / 2 - (edges[1].x + edges[3].x) / 2;
        const lead = Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? 2 : 0) : (dy >= 0 ? 3 : 1);
        const trail = (lead + 2) % 4;
        const now = performance.now();
        const held = now - lastMove < 180;
        lastMove = now;
        edges.forEach((s, i) => {
          if (held) s.set(r[i], 0.9, 900);
          else if (i === lead) s.set(r[i], 0.62, 700);
          else if (i === trail) s.set(r[i], 0.78, 360, 30);
          else s.set(r[i], 0.7, 520);
        });
      }
      current = item;
      shown = true;
      mark.classList.add("lit");
      run(tick);
    }
    const pick = (target) => {
      const item = target.closest && target.closest(items);
      return item && box.contains(item) && item !== mark ? item : null;
    };

    if (mode === "seg") {
      const rest = () => box.querySelector(":scope > .on:not(.glide)");
      requestAnimationFrame(() => go(rest(), true));
      new MutationObserver(() => { const on = rest(); if (on !== current) go(on); }).observe(box, { subtree: true, attributes: true, attributeFilter: ["class"] });
      addEventListener("resize", () => go(rest(), true));
      document.fonts && document.fonts.ready.then(() => go(rest(), true));
      return;
    }

    box.addEventListener("pointerover", (event) => {
      if (event.pointerType !== "mouse") return;
      hovering = true;
      const item = pick(event.target);
      if (item && item !== current) go(item);
    });
    box.addEventListener("pointerleave", (event) => {
      if (event.pointerType !== "mouse") return;
      hovering = false;
      if (!box.contains(document.activeElement) || !document.activeElement.matches(":focus-visible")) hide();
    });
    box.addEventListener("focusin", (event) => {
      if (!event.target.matches(":focus-visible")) return;
      const item = pick(event.target);
      if (item) go(item);
    });
    box.addEventListener("focusout", (event) => {
      if (!hovering && !box.contains(event.relatedTarget)) hide();
    });
    new MutationObserver(() => { if (current && !current.isConnected) hide(); }).observe(box, { childList: true, subtree: true });
    new ResizeObserver(() => { if (current) go(current, true); }).observe(box);
    if (box.matches(".faq-list")) box.addEventListener("toggle", () => { if (current) go(current, true); }, true);
  }

  function heroFlood() {
    const flood = $("hero-flood");
    const cta = $("hero-cta");
    const hero = flood && flood.parentElement;
    if (!flood) return;
    if (calm || !cta || scrollY > innerHeight * 0.6) {
      flood.style.clipPath = "none";
      root.classList.add("ready");
      return;
    }
    const box = flood.getBoundingClientRect();
    const from = cta.getBoundingClientRect();
    const start = [from.left - box.left, from.top - box.top, box.right - from.right, box.bottom - from.bottom];
    const far = Math.max(...start, 1);
    const pillR = from.height / 2;
    const restR = parseFloat(getComputedStyle(flood).borderTopLeftRadius) || 28;
    const edges = start.map((travel) => {
      const lead = travel / far;
      const s = new Spring(0, 0.002);
      s.set(1, 0.48, lerp(110, 190, lead) * 1.6, 180 * (1 - lead) * 0.6);
      return s;
    });
    flood.style.transition = "none";
    const paint = () => {
      const p = edges.map((s) => s.x);
      const mean = p.reduce((a, b) => a + Math.min(1, Math.max(0, b)), 0) / 4;
      const inset = start.map((v, i) => v * (1 - p[i]));
      const w = box.width - inset[0] - inset[2];
      const h = box.height - inset[1] - inset[3];
      const blob = Math.max(0, Math.sin(Math.PI * mean));
      const corner = lerp(lerp(pillR, restR, mean), Math.min(w, h) * 0.42, blob);
      flood.style.clipPath = `inset(${inset[1]}px ${inset[2]}px ${inset[3]}px ${inset[0]}px round ${Math.max(0, corner)}px)`;
    };
    paint();
    requestAnimationFrame(() => {
      root.classList.add("ready");
      run((dt, now) => {
        const alive = stepAll(edges, dt, now);
        paint();
        if (!alive) flood.style.clipPath = "none";
        return alive;
      });
    });
  }


  // Hero background: the launcher's empty-library scene (EmptyLibrary.kt) on its TiltedWall of capsules.
  function bezier(x1, y1, x2, y2) {
    const a = (p1, p2) => 1 - 3 * p2 + 3 * p1, b = (p1, p2) => 3 * p2 - 6 * p1, c = (p1) => 3 * p1;
    const at = (t, p1, p2) => ((a(p1, p2) * t + b(p1, p2)) * t + c(p1)) * t;
    const slope = (t, p1, p2) => 3 * a(p1, p2) * t * t + 2 * b(p1, p2) * t + c(p1);
    return (x) => {
      if (x <= 0) return 0;
      if (x >= 1) return 1;
      let t = x;
      for (let i = 0; i < 8; i++) { const d = slope(t, x1, x2); if (Math.abs(d) < 1e-6) break; t -= (at(t, x1, x2) - x) / d; }
      return at(Math.min(1, Math.max(0, t)), y1, y2);
    };
  }
  const InOut = bezier(0.42, 0, 0.58, 1), Out = bezier(0, 0, 0.58, 1), TraceEase = bezier(0.45, 0, 0.25, 1);
  const PopEase = bezier(0.15, 0.8, 0.3, 1), DropEase = bezier(0.6, 0, 0.9, 0.5), FlipEase = bezier(0.25, 0.7, 0.35, 1);
  const RippleEase = bezier(0.2, 0.6, 0.35, 1), HitEase = bezier(0.2, 0.7, 0.3, 1);
  const POP_FROM = 900, IMPACT = 2200, RIPPLE_MS = 1250, HIT_MS = 900, END = 3600, REVEAL_MS = 2300;
  const TRACE_DRAW_MS = 900, TRACE_FADE_MS = 500, REVEAL_FILL_FROM = 600, REVEAL_FILL_MS = 450, REVEAL_FADE_FROM = 1700, POKE = 880;
  const clamp01 = (v) => Math.min(1, Math.max(0, v));
  const span = (p, a, b, from, to, ease) => lerp(from, to, ease(clamp01((p - a) / (b - a))));
  const rippleTable = Array.from({ length: 257 }, (_, i) => RippleEase(i / 256));
  function rippleReaches(progress) {
    let lo = 0, hi = 256;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (rippleTable[mid] < progress) lo = mid + 1; else hi = mid; }
    return lo / 256;
  }
  function hitAmount(since) {
    if (since < 0 || since > HIT_MS) return 0;
    const p = since / HIT_MS;
    return p < 0.14 ? HitEase(p / 0.14) : 1 - HitEase((p - 0.14) / 0.86);
  }
  const MARK_LEFT = "M-31.98 0H56.055V40.489A71.81 71.81 0 0 0 56.055 183.231V223.72H-31.98Z";
  const MARK_RIGHT = "M71.885 0.28A111.96 111.86 0 0 1 71.885 223.44V183.231A71.81 71.81 0 0 0 71.885 40.489Z";
  function pathLength(d) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "path");
    svg.setAttribute("d", d);
    try { return svg.getTotalLength() || 900; } catch { return 900; }
  }
  const capsuleArt = (id) => `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${id}/library_600x900.jpg`;

  function heroWall() {
    const canvas = $("hero-wall");
    if (!canvas || !canvas.getContext) return;
    const panel = canvas.parentElement;
    const copy = document.querySelector(".hero-copy");
    const ctx = canvas.getContext("2d");
    const halves = [[new Path2D(MARK_LEFT), pathLength(MARK_LEFT)], [new Path2D(MARK_RIGHT), pathLength(MARK_RIGHT)]];
    const caps = [];
    let W = 0, H = 0, dpr = 1, capW = 132, capH = 198, gap = 16, ball = 36, speed = 72;
    let at = null, vx = 0, vy = 0, slam = null;
    let intro = 0, clock = 0, wallClock = 0, started = false, visible = true;

    function capsule(image) {
      const cap = { image, duo: document.createElement("canvas"), full: document.createElement("canvas"), ready: false };
      cap.paint = () => {
        const w = Math.round(capW * dpr), h = Math.round(capH * dpr), r = 12 * dpr;
        for (const [target, tint] of [[cap.duo, true], [cap.full, false]]) {
          target.width = w; target.height = h;
          const g = target.getContext("2d");
          g.save();
          g.beginPath(); g.roundRect(0, 0, w, h, r); g.clip();
          if (cap.image) {
            g.drawImage(cap.image, 0, 0, w, h);
            if (tint) { g.fillStyle = "rgba(7, 10, 16, 0.42)"; g.fillRect(0, 0, w, h); }
          } else {
            g.fillStyle = "#0f1522"; g.fillRect(0, 0, w, h);
          }
          g.restore();
          g.strokeStyle = tint ? "rgba(255, 255, 255, 0.1)" : "#1a9fff";
          g.lineWidth = dpr * (tint ? 1 : 2);
          g.beginPath(); g.roundRect(g.lineWidth / 2, g.lineWidth / 2, w - g.lineWidth, h - g.lineWidth, r); g.stroke();
        }
        cap.ready = true;
      };
      return cap;
    }

    function size() {
      const r = panel.getBoundingClientRect();
      if (!r.width) return;
      dpr = Math.min(2, devicePixelRatio || 1);
      W = r.width; H = r.height;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      const small = W < 640;
      capW = small ? 92 : 132; capH = capW * 1.5; gap = small ? 12 : 16;
      ball = small ? 24 : Math.min(44, Math.max(30, W * 0.026));
      speed = small ? 46 : 72;
      for (const cap of caps) cap.paint();
      if (!at) { at = { x: W * (small ? 0.78 : 0.82), y: H * (small ? 0.16 : 0.3) }; vx = -speed * 0.8; vy = speed * 0.6; }
      draw();
    }

    async function load() {
      const compat = await fetch("data/compat.json?v=5").then((r) => r.json()).catch(() => null);
      const ids = compat ? compat.games.map((g) => g.appid).filter(Boolean).slice(0, 42) : [];
      const blank = capsule(null);
      caps.push(blank);
      if (W) blank.paint();
      for (const id of ids) {
        const image = new Image();
        image.decoding = "async";
        image.onload = () => {
          if (image.naturalWidth < 100) return;
          const cap = capsule(image);
          if (W) cap.paint();
          if (caps.length === 1 && caps[0].image === null) caps.length = 0;
          caps.push(cap);
          if (calm) draw();
        };
        image.src = capsuleArt(id);
      }
    }

    function drawWall(t) {
      if (!caps.length) return;
      const tilt = (13 * Math.PI) / 180, cs = Math.cos(tilt), sn = Math.sin(tilt);
      const wallW = (W * cs + H * sn) * 1.1;
      const wallH = Math.max(H * 2.4, (W * sn + H * cs) * 1.1);
      const columns = Math.floor((wallW + gap) / (capW + gap)) + 1;
      const perRun = Math.floor((wallH + gap) / (capH + gap)) + 1;
      const runH = (capH + gap) * perRun;
      const shift = runH * ((wallClock % 40000) / 40000);
      const px = W / 2, py = H / 2;
      const left = px - wallW / 2, top = py - wallH / 2;
      const count = caps.length;
      const reach = (Math.hypot(capW, capH) / 2) * 0.77;
      const ringFrom = ball, ringTo = Math.hypot(W, H) * 1.05;
      const rippling = slam && t >= IMPACT && t <= IMPACT + RIPPLE_MS + HIT_MS;
      ctx.save();
      ctx.translate(px, py); ctx.rotate(-tilt); ctx.translate(-px, -py);
      for (let c = 0; c < columns; c++) {
        const x = left + c * (capW + gap);
        const dy = c % 2 === 0 ? -shift : shift - runH;
        for (let i = 0; i < perRun * 2; i++) {
          const y = top + i * (capH + gap) + dy;
          const lx = x + capW / 2 - px, ly = y + capH / 2 - py;
          const sx = px + lx * cs + ly * sn, sy = py - lx * sn + ly * cs;
          if (sx < -capH || sx > W + capH || sy < -capH || sy > H + capH) continue;
          const cap = caps[(c * 5 + (i % perRun) * 3) % count];
          if (!cap.ready) continue;
          let a = 0;
          if (rippling) {
            const edge = Math.max(0, Math.hypot(sx - slam.x, sy - slam.y) - reach);
            const progress = (edge - ringFrom) / (ringTo - ringFrom);
            if (progress <= 1) a = hitAmount(t - (IMPACT + RIPPLE_MS * rippleReaches(clamp01(progress))));
          }
          if (a > 0) {
            const grow = 1 + 0.045 * a, cx = x + capW / 2, cy = y + capH / 2;
            ctx.save();
            ctx.translate(cx, cy); ctx.scale(grow, grow); ctx.translate(-cx, -cy);
            ctx.fillStyle = `rgba(26, 159, 255, ${0.3 * a})`;
            ctx.beginPath(); ctx.roundRect(x - 5, y - 5, capW + 10, capH + 10, 16); ctx.fill();
            ctx.drawImage(cap.duo, x, y, capW, capH);
            ctx.globalAlpha = a;
            ctx.drawImage(cap.full, x, y, capW, capH);
            ctx.restore();
          } else ctx.drawImage(cap.duo, x, y, capW, capH);
        }
      }
      ctx.restore();
    }

    function drawMark(t) {
      if (!at) return;
      const s = ball / 55.98;
      const k = (223.72 * s) / 460;
      const c = at;
      if (slam && t >= IMPACT && t <= IMPACT + RIPPLE_MS) {
        const p = (t - IMPACT) / RIPPLE_MS;
        const alpha = p < 0.7 ? lerp(0.9, 0.35, p / 0.7) : lerp(0.35, 0, (p - 0.7) / 0.3);
        ctx.strokeStyle = `rgba(26, 159, 255, ${alpha})`;
        ctx.lineWidth = Math.max(2.5 * k, 1.5);
        ctx.beginPath(); ctx.arc(slam.x, slam.y, lerp(ball, Math.hypot(W, H) * 1.05, RippleEase(p)), 0, Math.PI * 2); ctx.stroke();
      }
      let shake = 0;
      if (t >= IMPACT && t <= IMPACT + 230) {
        const p = (t - IMPACT) / 230;
        shake = (p < 0.25 ? span(p, 0, 0.25, 0, 7, Out) : p < 0.55 ? span(p, 0.25, 0.55, 7, -3, Out) : span(p, 0.55, 1, -3, 0, Out)) * k;
      }
      ctx.save();
      ctx.translate(0, shake);
      const markAt = (lift) => { ctx.translate(c.x - 63.98 * s, c.y - 111.86 * s + lift); ctx.scale(s, s); };
      const since = t - IMPACT;
      if (since >= 0 && since <= REVEAL_MS) {
        const fade = 1 - clamp01((since - REVEAL_FADE_FROM) / (REVEAL_MS - REVEAL_FADE_FROM));
        const fill = Out(clamp01((since - REVEAL_FILL_FROM) / REVEAL_FILL_MS)) * fade;
        if (fill > 0) {
          const lift = 8 * k * (1 - fill / fade);
          for (const [edge, color] of [[5, `rgba(120, 140, 180, ${fill})`], [0, `rgba(255, 255, 255, ${fill})`]]) {
            ctx.save(); markAt(lift + edge * s); ctx.fillStyle = color;
            for (const [half] of halves) ctx.fill(half);
            ctx.restore();
          }
        }
        const drawn = TraceEase(clamp01(since / TRACE_DRAW_MS));
        const alpha = clamp01(since < TRACE_DRAW_MS ? 1 : 1 - (since - TRACE_DRAW_MS) / TRACE_FADE_MS) * fade;
        if (alpha > 0) {
          ctx.save(); markAt(0);
          ctx.strokeStyle = `rgba(26, 159, 255, ${alpha})`; ctx.lineWidth = 3; ctx.lineJoin = "round";
          for (const [half, length] of halves) { ctx.setLineDash([length * drawn, length]); ctx.stroke(half); }
          ctx.restore();
        }
      }
      const shown = Out(clamp01((intro - 650) / 300));
      if (shown > 0) {
        const p = (t - POP_FROM) / (IMPACT - POP_FROM);
        let pop = 1, rise = 0;
        if (p > 0 && p < 1) {
          if (p < 0.11) { pop = span(p, 0, 0.11, 1, 0.92, InOut); rise = span(p, 0, 0.11, 0, 7, InOut); }
          else if (p < 0.31) { pop = span(p, 0.11, 0.31, 0.92, 1.6, PopEase); rise = span(p, 0.11, 0.31, 7, -42, PopEase); }
          else if (p < 0.88) { pop = span(p, 0.31, 0.88, 1.6, 1.54, InOut); rise = span(p, 0.31, 0.88, -42, -34, InOut); }
          else { pop = span(p, 0.88, 1, 1.54, 1, DropEase); rise = span(p, 0.88, 1, -34, 0, DropEase); }
        }
        const q = clamp01((pop - 1) / 0.6);
        const bob = t > END ? -4 * k * (0.5 - 0.5 * Math.cos((2 * Math.PI * (t - END)) / 5200)) : 0;
        const blur = lerp(10, 28, q) * k, sr = ball * 0.93 * lerp(1, 1.4, q);
        const sx = c.x + 20 * k * q, sy = c.y + 48 * k * q;
        const shadow = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr + blur);
        const dark = `rgba(0, 0, 0, ${lerp(0.6, 0.25, q) * shown})`;
        shadow.addColorStop(0, dark); shadow.addColorStop(Math.max(0, sr - blur) / (sr + blur), dark); shadow.addColorStop(1, "rgba(0, 0, 0, 0)");
        ctx.fillStyle = shadow; ctx.beginPath(); ctx.arc(sx, sy, sr + blur, 0, Math.PI * 2); ctx.fill();
        let sqx = 1, sqy = 1;
        if (t >= IMPACT && t <= IMPACT + 280) {
          const v = (t - IMPACT) / 280;
          if (v < 0.3) { sqx = span(v, 0, 0.3, 1, 1.1, Out); sqy = span(v, 0, 0.3, 1, 0.88, Out); }
          else if (v < 0.65) { sqx = span(v, 0.3, 0.65, 1.1, 0.97, Out); sqy = span(v, 0.3, 0.65, 0.88, 1.04, Out); }
          else { sqx = span(v, 0.65, 1, 0.97, 1, Out); sqy = span(v, 0.65, 1, 1.04, 1, Out); }
        }
        const grow = lerp(0.6, 1, shown) * pop;
        const turn = (720 * FlipEase(clamp01((t - 1290) / 760)) * Math.PI) / 180;
        ctx.save();
        ctx.translate(c.x, c.y + rise * k + bob); ctx.scale(grow * sqx, grow * sqy);
        const cs = Math.cos(turn), half = ((ball * 2 * 0.061) / 2) * Math.sin(turn), rx = Math.max(0.01, ball * Math.abs(cs));
        ctx.globalAlpha = shown;
        if (Math.abs(half) > 0.01) {
          ctx.fillStyle = "#0e5fae";
          ctx.beginPath(); ctx.ellipse(-half, 0, rx, ball, 0, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.ellipse(half, 0, rx, ball, 0, 0, Math.PI * 2); ctx.fill();
          ctx.fillRect(Math.min(-half, half), -ball, Math.abs(2 * half), 2 * ball);
        }
        ctx.fillStyle = "#1a9fff";
        ctx.beginPath(); ctx.ellipse(cs >= 0 ? half : -half, 0, rx, ball, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
      if (t >= IMPACT && t <= IMPACT + 420) {
        const p = Out((t - IMPACT) / 420);
        ctx.strokeStyle = `rgba(26, 159, 255, ${1 - p})`;
        ctx.lineWidth = Math.max(4 * k, 2);
        ctx.beginPath(); ctx.arc(c.x, c.y, (ball + 6 * k) * lerp(1, 1.4, p), 0, Math.PI * 2); ctx.stroke();
      }
      ctx.restore();
    }

    function draw() {
      if (!W) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      drawWall(clock);
      drawMark(clock);
    }

    function avoidRect() {
      if (!copy || W < 760) return null;
      const a = copy.getBoundingClientRect(), b = panel.getBoundingClientRect();
      return { left: a.left - b.left - 12, top: a.top - b.top - 12, right: a.right - b.left + 12, bottom: a.bottom - b.top + 12 };
    }

    function move(ms) {
      let x = at.x + (vx * ms) / 1000, y = at.y + (vy * ms) / 1000;
      const floor = H * 0.86;
      if (x - ball < 0) { x = ball; vx = Math.abs(vx); }
      if (x + ball > W) { x = W - ball; vx = -Math.abs(vx); }
      if (y - ball < 0) { y = ball; vy = Math.abs(vy); }
      if (y + ball > floor) { y = floor - ball; vy = -Math.abs(vy); }
      const r = avoidRect();
      if (r) {
        const nearX = Math.min(r.right, Math.max(r.left, x)), nearY = Math.min(r.bottom, Math.max(r.top, y));
        const gx = x - nearX, gy = y - nearY, gap = Math.hypot(gx, gy);
        if (gap > 0.0001 && gap <= ball) {
          const nx = gx / gap, ny = gy / gap;
          x = nearX + nx * ball; y = nearY + ny * ball;
          const into = vx * nx + vy * ny;
          if (into < 0) { vx -= 2 * into * nx; vy -= 2 * into * ny; }
        } else if (gap <= 0.0001) {
          const outX = x < (r.left + r.right) / 2 ? r.left - ball - x : r.right + ball - x;
          const outY = y < (r.top + r.bottom) / 2 ? r.top - ball - y : r.bottom + ball - y;
          if (Math.abs(outX) < Math.abs(outY)) { x += outX; vx = outX < 0 ? -Math.abs(vx) : Math.abs(vx); }
          else { y += outY; vy = outY < 0 ? -Math.abs(vy) : Math.abs(vy); }
        }
      }
      at = { x, y };
    }

    function tick(dt) {
      if (!visible || document.hidden) { started = false; return false; }
      const ms = Math.min(50, dt * 1000);
      intro += ms; wallClock += ms;
      const before = clock;
      clock += ms;
      if (at) move(ms);
      if (before < IMPACT && clock >= IMPACT) slam = { ...at };
      draw();
      return true;
    }
    function go() { if (calm || started || !visible || document.hidden) return; started = true; run(tick); }

    size();
    new ResizeObserver(size).observe(panel);
    load();
    if (calm) {
      intro = END; clock = END + 2600;
      return;
    }
    new IntersectionObserver((entries) => { visible = entries.some((e) => e.isIntersecting); if (visible) go(); }).observe(panel);
    document.addEventListener("visibilitychange", go);
    panel.parentElement.addEventListener("click", (event) => {
      if (event.target.closest("a, button") || !at) return;
      const b = panel.getBoundingClientRect();
      if (Math.hypot(event.clientX - b.left - at.x, event.clientY - b.top - at.y) <= ball * 1.4 && clock >= IMPACT + RIPPLE_MS) clock = POKE;
    });
    setTimeout(go, 250);
  }

  function detailFlood() {
    const dialog = $("detail");
    const main = document.querySelector("main");
    if (!dialog || calm) return;
    let origin = null;
    let sheet = null;
    let busy = false;
    const real = dialog.showModal.bind(dialog);

    document.addEventListener("click", (event) => {
      const hit = event.target.closest(".game, .device-list button, .bench-list button");
      if (hit && !dialog.contains(hit)) origin = hit;
    }, true);

    function blob(color, radius) {
      const node = document.createElement("div");
      node.className = "flood";
      node.style.borderRadius = `${radius}px`;
      node.style.background = color;
      return node;
    }
    function veil(on) {
      const node = document.createElement("div");
      node.className = "flood-veil";
      node.style.opacity = on ? "0" : "1";
      document.body.append(node);
      requestAnimationFrame(() => requestAnimationFrame(() => { node.style.opacity = on ? "1" : "0"; }));
      return node;
    }
    function sink(on) {
      if (on) main.style.transformOrigin = `50% ${scrollY + innerHeight / 2}px`;
      main.classList.toggle("sunk", on);
    }
    function target() {
      const keep = dialog.getAttribute("style");
      Object.assign(dialog.style, { display: "block", visibility: "hidden", position: "fixed", inset: "0", margin: "auto" });
      const r = dialog.getBoundingClientRect();
      if (keep === null) dialog.removeAttribute("style"); else dialog.setAttribute("style", keep);
      return r;
    }
    function drive(node, a, b, edges, radii, onFrame) {
      const paint = () => {
        const p = edges.map((s) => s.x);
        const l = lerp(a.left, b.left, p[0]);
        const t = lerp(a.top, b.top, p[1]);
        const r = lerp(a.right, b.right, p[2]);
        const bo = lerp(a.bottom, b.bottom, p[3]);
        const w = Math.max(0, r - l);
        const h = Math.max(0, bo - t);
        const mean = p.reduce((s, v) => s + Math.min(1, Math.max(0, v)), 0) / 4;
        const round = Math.max(0, Math.sin(Math.PI * mean));
        node.style.transform = `translate(${l}px, ${t}px)`;
        node.style.width = `${w}px`;
        node.style.height = `${h}px`;
        node.style.borderRadius = `${lerp(lerp(radii[0], radii[1], mean), Math.min(w, h) * 0.42, round * 0.6)}px`;
        if (onFrame) onFrame(p, mean);
      };
      paint();
      return (dt, now) => { const alive = stepAll(edges, dt, now); paint(); return alive; };
    }
    function springsFor(a, b, z, page) {
      const travel = [Math.abs(a.left - b.left), Math.abs(a.top - b.top), Math.abs(a.right - b.right), Math.abs(a.bottom - b.bottom)];
      const far = Math.max(...travel, 1);
      return travel.map((d) => {
        const lead = d / far;
        const s = new Spring(0, 0.002);
        s.set(1, z, lerp(110, 190, lead) * page, 180 * (1 - lead) * 0.6);
        return s;
      });
    }

    dialog.showModal = () => {
      if (busy) return;
      const from = origin && origin.isConnected ? origin.getBoundingClientRect() : null;
      origin = origin && origin.isConnected ? origin : null;
      if (!from || from.bottom < 0 || from.top > innerHeight) return real();
      busy = true;
      const to = target();
      sheet = to;
      const style = getComputedStyle(origin);
      const node = blob(style.backgroundColor === "rgba(0, 0, 0, 0)" ? "#0f1522" : style.backgroundColor, parseFloat(style.borderTopLeftRadius) || 16);
      document.body.append(node);
      const shade = veil(true);
      sink(true);
      const edges = springsFor(from, to, 0.55, 2.4);
      let covered = false;
      const tick = drive(node, from, to, edges, [parseFloat(style.borderTopLeftRadius) || 16, 28], (p, mean) => {
        const mix = Math.sin(Math.PI * Math.min(1, mean)) * 0.8;
        node.style.background = `color-mix(in oklab, #0f1522 ${Math.round((1 - mix) * 100)}%, #1a9fff)`;
        if (!covered && p.every((v) => v >= 0.98)) {
          covered = true;
          dialog.classList.add("landed");
          real();
          dialog.scrollTop = 0;
          shade.remove();
          setTimeout(() => { node.style.transition = "opacity .2s"; node.style.opacity = "0"; setTimeout(() => node.remove(), 220); dialog.classList.remove("landed"); busy = false; }, 260);
        }
      });
      run(tick);
    };

    dialog.addEventListener("close", () => {
      sink(false);
      if (busy || !sheet) return;
      const from = sheet;
      const to = origin && origin.isConnected ? origin.getBoundingClientRect() : null;
      if (!to || to.bottom < 0 || to.top > innerHeight) return;
      const style = getComputedStyle(origin);
      const node = blob("#0f1522", 28);
      node.style.boxShadow = "inset 0 0 0 1px #2a3a5e";
      document.body.append(node);
      const shade = veil(false);
      const edges = springsFor(from, to, 1, 3.2);
      const tick = drive(node, from, to, edges, [28, parseFloat(style.borderTopLeftRadius) || 16]);
      run((dt, now) => {
        const alive = tick(dt, now) && edges.some((s) => Math.abs(s.x - 1) > 0.015);
        if (!alive) {
          node.style.transition = "opacity .18s";
          node.style.opacity = "0";
          setTimeout(() => { node.remove(); shade.remove(); }, 200);
        }
        return alive;
      });
    });
  }

  function steps() {
    const list = document.querySelector(".steps");
    if (!list) return;
    const rows = [...list.children];
    let queued = false;
    const update = () => {
      queued = false;
      const line = innerHeight * 0.6;
      const r = list.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, (line - r.top - 30) / Math.max(1, r.height - 60)));
      list.style.setProperty("--p", p.toFixed(4));
      for (const row of rows) row.classList.toggle("past", row.getBoundingClientRect().top + 30 < line);
    };
    addEventListener("scroll", () => { if (!queued) { queued = true; requestAnimationFrame(update); } }, { passive: true });
    update();
  }

  function deal() {
    for (const id of ["games", "video-list"]) {
      const box = $(id);
      if (!box) continue;
      const number = () => [...box.children].forEach((child, index) => child.style.setProperty("--n", index));
      new MutationObserver(number).observe(box, { childList: true });
      number();
    }
  }

  for (const box of document.querySelectorAll("[data-glide]")) glide(box);
  heroFlood();
  heroWall();
  detailFlood();
  steps();
  deal();
})();
