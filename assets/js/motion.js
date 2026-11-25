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
    const handheld = hero && hero.querySelector(".handheld");
    if (!flood) return;
    const measure = () => {
      if (!handheld) return;
      const top = handheld.offsetTop + handheld.offsetParent.offsetTop;
      flood.style.setProperty("--flood-bottom", `${Math.max(0, hero.offsetHeight - (top + handheld.offsetHeight * 0.58))}px`);
    };
    measure();
    new ResizeObserver(measure).observe(hero);
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
  detailFlood();
  steps();
  deal();
})();
