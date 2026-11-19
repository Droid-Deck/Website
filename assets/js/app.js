(() => {
  const REPO = "Droid-Deck/DroidDeck";
  const API = "https://api.github.com";
  const ART = "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/";
  const THUMB = "https://i.ytimg.com/vi/";
  const PLAYER = "https://www.youtube-nocookie.com/embed/";
  const TUBE = "https://www.youtube.com/results?search_query=";
  const INVITE = "https://discord.com/api/v10/invites/JRGAvawjsm?with_counts=true";
  const MAKERS = /^(samsung galaxy|samsung|ayaneo|ayn|xiaomi|oneplus|google|lenovo|asus|nubia) /;
  const LANGS = [
    ["en", "English"], ["ar", "العربية"], ["bg", "Български"], ["cs", "Čeština"], ["da", "Dansk"], ["de", "Deutsch"],
    ["el", "Ελληνικά"], ["es", "Español"], ["es-419", "Español (Latinoamérica)"], ["fi", "Suomi"], ["fr", "Français"],
    ["hi", "हिन्दी"], ["hu", "Magyar"], ["id", "Indonesia"], ["it", "Italiano"], ["ja", "日本語"], ["ko", "한국어"],
    ["ms", "Melayu"], ["nb", "Norsk"], ["nl", "Nederlands"], ["pl", "Polski"], ["pt-BR", "Português (Brasil)"],
    ["pt-PT", "Português (Portugal)"], ["ro", "Română"], ["ru", "Русский"], ["sv", "Svenska"], ["th", "ไทย"],
    ["tr", "Türkçe"], ["uk", "Українська"], ["vi", "Tiếng Việt"], ["zh-CN", "简体中文"], ["zh-HK", "繁體中文 (香港)"],
    ["zh-TW", "繁體中文 (台灣)"]
  ];
  const CODES = LANGS.map(([code]) => code);
  const RANK = { great: 3, playable: 2, runs: 1 };
  const FIRST_GAMES = 12;
  const FIRST_VIDEOS = 6;
  const DETAIL_VIDEOS = 6;
  const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const $ = (id) => document.getElementById(id);
  const all = (selector, root = document) => [...root.querySelectorAll(selector)];

  const state = { lang: "en", base: {}, strings: {}, live: null, compat: null, bench: [], videos: [], detail: null, films: FIRST_VIDEOS, stars: 0, shown: false, more: false, status: "", device: "", query: "" };

  function stored(key) {
    try { return localStorage.getItem(key); } catch { return null; }
  }

  function store(key, value) {
    try { localStorage.setItem(key, value); } catch {}
  }

  function match(tag) {
    if (!tag) return "";
    const lower = tag.toLowerCase();
    const exact = CODES.find((code) => code.toLowerCase() === lower);
    if (exact) return exact;
    const [base, ...rest] = lower.split("-");
    if (base === "zh") {
      if (rest.includes("hk") || rest.includes("mo")) return "zh-HK";
      if (rest.includes("tw") || rest.includes("hant")) return "zh-TW";
      return "zh-CN";
    }
    if (base === "pt") return rest.includes("pt") ? "pt-PT" : "pt-BR";
    if (base === "es") return rest.length && !rest.includes("es") ? "es-419" : "es";
    if (base === "no" || base === "nn") return "nb";
    if (base === "in") return "id";
    return CODES.find((code) => code === base) || "";
  }

  function detect() {
    const asked = match(new URLSearchParams(location.search).get("lang"));
    if (asked) return asked;
    const kept = match(stored("lang"));
    if (kept) return kept;
    for (const tag of navigator.languages || [navigator.language]) {
      const found = match(tag);
      if (found) return found;
    }
    return "en";
  }

  async function json(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${response.status} ${url}`);
    return response.json();
  }

  function t(key, vars) {
    const text = state.strings[key] ?? state.base[key] ?? "";
    return text.replace(/\{(\w+)\}/g, (whole, name) => (vars && name in vars ? vars[name] : whole));
  }

  function number(value, options) {
    return new Intl.NumberFormat(state.lang, options).format(value);
  }

  function vars() {
    const live = state.live;
    if (!live) return {};
    const crowd = live.discord || {};
    return {
      members: crowd.members ? number(crowd.members) : undefined,
      online: crowd.online ? number(crowd.online) : undefined,
      version: live.release.tag,
      date: new Intl.DateTimeFormat(state.lang, { dateStyle: "medium" }).format(new Date(live.release.published)),
      n: number(live.contributors.length),
      time: new Intl.DateTimeFormat(state.lang, { dateStyle: "medium", timeStyle: "short" }).format(new Date(live.updated))
    };
  }

  function translate() {
    const known = vars();
    document.documentElement.lang = state.lang;
    document.documentElement.dir = state.lang === "ar" ? "rtl" : "ltr";
    for (const node of all("[data-i18n]")) {
      const needs = node.dataset.i18nVars;
      if (needs && known[needs] === undefined) continue;
      const text = t(node.dataset.i18n, known);
      if (text) node.textContent = text;
    }
    for (const node of all("[data-i18n-attr]")) {
      for (const pair of node.dataset.i18nAttr.split(";")) {
        const [attr, key] = pair.split(":");
        const text = t(key, known);
        if (text) node.setAttribute(attr, text);
      }
    }
    if ($("lang-code")) $("lang-code").textContent = state.lang.toUpperCase();
    if ($("updated") && known.time) $("updated").textContent = t("footer.updated", known);
    for (const button of all("#lang-menu button")) button.setAttribute("aria-current", String(button.dataset.lang === state.lang));
  }

  async function setLang(code, keep) {
    state.lang = code;
    if (keep) store("lang", code);
    state.strings = code === "en" ? state.base : await json(`i18n/${code}.json`).catch(() => state.base);
    translate();
    paint();
  }

  function paintLive() {
    const live = state.live;
    if (!live) return;
    const values = {
      version: live.release.tag,
      date: vars().date,
      size: number(live.release.size / 1048576, { style: "unit", unit: "megabyte", maximumFractionDigits: 0 }),
      downloads: number(live.downloads),
      "downloads-short": number(live.downloads, { notation: "compact", maximumFractionDigits: 2 }),
      rank: number(live.rank),
      forks: number(live.forks),
      people: number(live.contributors.length)
    };
    for (const node of all("[data-live]")) node.textContent = values[node.dataset.live] ?? "";
    if ($("flaps")) $("flaps").setAttribute("aria-label", `${number(state.stars)} ${t("stars.label")}`);
  }

  function flapNode() {
    const flap = document.createElement("div");
    flap.className = "flap";
    for (const part of ["top", "bot", "ftop", "fbot"]) {
      const face = document.createElement("span");
      face.className = part;
      face.textContent = "0";
      flap.append(face);
    }
    flap.dataset.value = "0";
    return flap;
  }

  function buildFlaps(length) {
    const board = $("flaps");
    board.textContent = "";
    for (let index = 0; index < length; index++) {
      if (index && (length - index) % 3 === 0) {
        const gap = document.createElement("div");
        gap.className = "flap gap";
        board.append(gap);
      }
      board.append(flapNode());
    }
  }

  function flip(flap, next, speed) {
    return new Promise((done) => {
      const current = flap.dataset.value;
      if (current === next) return done();
      const [top, bot, ftop, fbot] = flap.children;
      flap.dataset.value = next;
      if (calm) {
        for (const face of flap.children) face.textContent = next;
        return done();
      }
      flap.style.setProperty("--flip", `${speed}s`);
      ftop.textContent = current;
      top.textContent = next;
      fbot.textContent = next;
      flap.classList.add("go");
      setTimeout(() => {
        bot.textContent = next;
        ftop.textContent = next;
        flap.classList.remove("go");
        done();
      }, speed * 2000 + 20);
    });
  }

  async function settle(flap, target, turns) {
    for (let turn = turns; turn > 0; turn--) {
      const digit = (Number(target) + 10 - (turn % 10)) % 10;
      await flip(flap, String(digit), 0.055);
    }
    await flip(flap, target, 0.16);
  }

  function showStars(value) {
    if (!value || !$("flaps")) return;
    const digits = String(value);
    const flaps = () => all(".flap:not(.gap)", $("flaps"));
    const first = !state.shown;
    if (flaps().length !== digits.length) buildFlaps(digits.length);
    state.stars = value;
    paintLive();
    if (!state.visible) return;
    state.shown = true;
    flaps().forEach((flap, index) => {
      if (first) settle(flap, digits[index], 5 + index * 3);
      else flip(flap, digits[index], 0.3);
    });
  }

  async function refresh() {
    if (document.hidden) return;
    try {
      const repo = await json(`${API}/repos/${REPO}`);
      const changed = repo.stargazers_count !== state.stars;
      state.live.forks = repo.forks_count;
      showStars(repo.stargazers_count);
      if (changed) {
        const ahead = await json(`${API}/search/repositories?q=${encodeURIComponent(`stars:>${repo.stargazers_count}`)}&per_page=1`);
        state.live.rank = ahead.total_count + 1;
        paintLive();
      }
    } catch {}
  }

  async function latest() {
    try {
      const release = await json(`${API}/repos/${REPO}/releases/latest`);
      if (release.tag_name === state.live.release.tag) return;
      const apk = release.assets.find((asset) => asset.name.endsWith(".apk"));
      state.live.release = { tag: release.tag_name, url: release.html_url, published: release.published_at, size: apk ? apk.size : state.live.release.size };
      translate();
      paintLive();
    } catch {}
  }

  function best(reports) {
    return reports.reduce((top, report) => (RANK[report.status] > RANK[top] ? report.status : top), "runs");
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function ago(stamp) {
    const days = Math.max(0, Math.round((Date.now() - new Date(stamp)) / 86400000));
    const format = new Intl.RelativeTimeFormat(state.lang, { numeric: "auto" });
    if (days < 14) return format.format(-days, "day");
    if (days < 60) return format.format(-Math.round(days / 7), "week");
    if (days < 365) return format.format(-Math.round(days / 30), "month");
    return format.format(-Math.round(days / 365), "year");
  }

  function videoCard(video) {
    const card = el("article", "video");
    const thumb = el("button", "video-thumb");
    thumb.type = "button";
    thumb.setAttribute("aria-label", video.title);
    const image = new Image();
    image.loading = "lazy";
    image.alt = "";
    image.src = `${THUMB}${video.id}/hqdefault.jpg`;
    thumb.append(image, el("i", "video-play"));
    if (video.length) thumb.append(el("span", "video-length", video.length));
    thumb.addEventListener("click", () => {
      const frame = el("iframe");
      frame.src = `${PLAYER}${video.id}?autoplay=1&rel=0`;
      frame.title = video.title;
      frame.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen";
      frame.allowFullscreen = true;
      const stage = el("div", "video-thumb");
      stage.append(frame);
      thumb.replaceWith(stage);
    });
    const title = el("h3", "video-title", video.title);
    title.dir = "auto";
    const meta = [video.channel, video.published ? ago(video.published) : ""].filter(Boolean).join(" · ");
    card.append(thumb, title, el("p", "video-meta", meta));
    return card;
  }

  function paintVideos() {
    const list = $("video-list");
    if (!list) return;
    list.textContent = "";
    for (const video of state.videos.slice(0, state.films)) list.append(videoCard(video));
    $("videos").hidden = !state.videos.length;
    $("videos-more").hidden = state.films >= Math.min(state.videos.length, FIRST_VIDEOS * 3);
  }

  function videosFor(name) {
    const lower = name.toLowerCase();
    const tests = [...new Set([lower, lower.replace(MAKERS, "")])]
      .filter((needle) => needle.length > 3)
      .map((needle) => new RegExp(`(?<![a-z0-9])${needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![a-z0-9])`));
    return state.videos.filter((video) => {
      const text = `${video.title} ${video.text || ""}`.toLowerCase();
      return tests.some((test) => test.test(text));
    });
  }

  function reportRow(report, label, action) {
    const row = el(action ? "button" : "div", "report");
    if (action) { row.type = "button"; row.addEventListener("click", action); }
    row.append(el("i", `dot ${report.status}`), el("span", "", label));
    const detail = [action ? "" : report.gpu || report.soc, report.note].filter(Boolean).join(" · ");
    if (detail) row.append(el("small", "", detail));
    return row;
  }

  function gameArt(game, art) {
    const fallback = () => { art.textContent = ""; art.append(el("span", "", game.name)); };
    if (!game.appid && !game.art) return fallback();
    const image = new Image();
    image.loading = "lazy";
    image.alt = "";
    image.src = game.art || `${ART}${game.appid}/header.jpg`;
    image.onerror = fallback;
    art.append(image);
  }

  function paintDetail() {
    const dialog = $("detail");
    if (!dialog || !state.detail) return;
    const { game, device } = state.detail;
    const name = (game || device).name;
    const rows = $("detail-rows");
    const art = $("detail-art");
    art.textContent = "";
    rows.textContent = "";
    art.hidden = !game;
    $("detail-name").textContent = name;
    if (game) {
      gameArt(game, art);
      $("detail-meta").textContent = [game.stores.join(", "), t(`compat.${best(game.reports)}`)].filter(Boolean).join(" · ");
      $("detail-label").textContent = t("detail.reports");
      for (const report of game.reports) rows.append(reportRow(report, report.device));
    } else {
      const desk = state.bench.find((entry) => entry.name === name);
      const sent = desk && desk.from ? t("bench.sent", { maker: desk.from }) : "";
      $("detail-meta").textContent = [device.gpu || device.soc || device.chip, desk ? t("bench.dev") : "", sent].filter(Boolean).join(" · ");
      $("detail-label").textContent = t("detail.games");
      const played = state.compat ? state.compat.games.filter((entry) => entry.reports.some((report) => report.device === name)) : [];
      played.sort((a, b) => a.name.localeCompare(b.name));
      for (const entry of played) {
        const report = entry.reports.find((item) => item.device === name);
        rows.append(reportRow(report, entry.name, () => openDetail({ game: entry })));
      }
    }
    $("detail-block").hidden = !rows.children.length;
    const videos = videosFor(name).slice(0, DETAIL_VIDEOS);
    const list = $("detail-videos");
    list.textContent = "";
    for (const video of videos) list.append(videoCard(video));
    $("detail-none").hidden = videos.length > 0;
    $("detail-search").href = `${TUBE}${encodeURIComponent(`DroidDeck ${name}`)}`;
  }

  function openDetail(detail) {
    const dialog = $("detail");
    if (!dialog) return;
    state.detail = detail;
    paintDetail();
    if (!dialog.open) dialog.showModal();
    dialog.scrollTop = 0;
  }

  function gameCard(game, reports) {
    const card = el("button", "game");
    card.type = "button";
    const art = el("div", "game-art");
    gameArt(game, art);
    const body = el("div", "game-body");
    const top = best(reports);
    const meta = el("div", "game-meta");
    meta.append(el("i", `dot ${top}`), el("span", "", t(`compat.${top}`)), el("span", "game-store", game.stores.length > 1 ? `${game.stores[0]} +${game.stores.length - 1}` : game.stores[0] || ""));
    body.append(el("div", "game-name", game.name), meta);
    card.append(art, body);
    card.addEventListener("click", () => openDetail({ game }));
    return card;
  }

  function paintGames() {
    const compat = state.compat;
    if (!compat || !$("games")) return;
    const query = state.query.trim().toLowerCase();
    const found = [];
    for (const game of compat.games) {
      if (query && !game.name.toLowerCase().includes(query)) continue;
      const reports = game.reports.filter((report) => (!state.device || report.device === state.device) && (!state.status || report.status === state.status));
      if (reports.length) found.push([game, reports]);
    }
    found.sort((a, b) => RANK[best(b[1])] - RANK[best(a[1])] || b[0].reports.length - a[0].reports.length || a[0].name.localeCompare(b[0].name));
    const open = state.more || query || state.device || state.status;
    const grid = $("games");
    grid.textContent = "";
    for (const [game, reports] of open ? found : found.slice(0, FIRST_GAMES)) grid.append(gameCard(game, reports));
    $("games-empty").hidden = found.length > 0;
    const more = $("games-more");
    more.hidden = Boolean(query || state.device || state.status) || found.length <= FIRST_GAMES;
    more.textContent = state.more ? t("compat.less") : t("compat.more", { n: number(found.length) });
  }

  function paintDevices() {
    const compat = state.compat;
    if (!compat || !$("compat-device")) return;
    const select = $("compat-device");
    const named = compat.devices.filter((device) => !/ device$/.test(device.name));
    select.textContent = "";
    select.append(new Option(t("compat.all"), ""));
    for (const device of [...named].sort((a, b) => a.name.localeCompare(b.name))) select.append(new Option(device.name, device.name));
    select.value = state.device;
    const list = $("device-list");
    list.textContent = "";
    for (const device of named) {
      const item = el("li");
      const button = el("button", "", device.name);
      button.type = "button";
      if (device.gpu || device.soc) button.append(el("small", "", device.gpu || device.soc));
      button.addEventListener("click", () => openDetail({ device }));
      item.append(button);
      list.append(item);
    }
  }

  function paintBench() {
    const list = $("bench");
    if (!list) return;
    list.textContent = "";
    for (const device of state.bench) {
      const item = el("li");
      const button = el("button");
      button.type = "button";
      button.append(el("strong", "", device.name));
      if (device.chip) button.append(el("small", "", device.chip));
      if (device.from) button.append(el("em", "", t("bench.sent", { maker: device.from })));
      button.addEventListener("click", () => openDetail({ device }));
      item.append(button);
      list.append(item);
    }
  }

  function paintPeople() {
    const live = state.live;
    if (!live || !$("leads")) return;
    const leads = $("leads");
    const crowd = $("crowd");
    leads.textContent = "";
    crowd.textContent = "";
    live.contributors.forEach((person, index) => {
      const link = el("a");
      link.href = person.url;
      link.rel = "noopener";
      const face = new Image();
      face.loading = "lazy";
      face.alt = "";
      face.src = person.avatar;
      face.width = face.height = index < 3 ? 60 : 54;
      if (index < 3) {
        const item = el("li", "lead");
        const words = el("div");
        words.append(el("strong", "", person.login), el("small", "", person.areas.map((area) => t(`area.${area}`) || area).join(" · ")));
        link.append(face, words);
        item.append(link);
        leads.append(item);
        return;
      }
      const item = el("li");
      link.dataset.name = person.login;
      link.setAttribute("aria-label", person.login);
      link.append(face);
      item.append(link);
      crowd.append(item);
    });
  }

  function paint() {
    paintLive();
    paintGames();
    paintDevices();
    paintBench();
    paintPeople();
    paintVideos();
    paintDetail();
  }

  async function crowd() {
    try {
      const invite = await json(INVITE);
      state.live.discord = { members: invite.approximate_member_count, online: invite.approximate_presence_count };
      translate();
    } catch {}
  }

  function menus() {
    const menu = $("lang-menu");
    const toggle = $("lang-toggle");
    if (menu) {
      for (const [code, name] of LANGS) {
        const button = el("button", "", name);
        button.type = "button";
        button.lang = code;
        button.dataset.lang = code;
        menu.append(button);
      }
      const close = () => { menu.hidden = true; toggle.setAttribute("aria-expanded", "false"); };
      toggle.addEventListener("click", () => { menu.hidden = !menu.hidden; toggle.setAttribute("aria-expanded", String(!menu.hidden)); });
      menu.addEventListener("click", (event) => {
        const code = event.target.dataset.lang;
        if (!code) return;
        close();
        setLang(code, true);
      });
      document.addEventListener("click", (event) => { if (!$("lang").contains(event.target)) close(); });
      document.addEventListener("keydown", (event) => { if (event.key === "Escape") close(); });
    }
    const burger = $("burger");
    if (burger) {
      const links = $("links");
      const set = (open) => { links.classList.toggle("open", open); burger.setAttribute("aria-expanded", String(open)); };
      burger.addEventListener("click", () => set(!links.classList.contains("open")));
      links.addEventListener("click", () => set(false));
      document.addEventListener("click", (event) => { if (!$("bar").contains(event.target)) set(false); });
      document.addEventListener("keydown", (event) => {
        if (event.key !== "Escape" || !links.classList.contains("open")) return;
        set(false);
        burger.focus();
      });
    }
    const bar = $("bar");
    if (bar) {
      const stick = () => bar.classList.toggle("stuck", scrollY > 8);
      addEventListener("scroll", stick, { passive: true });
      stick();
    }
  }

  function filters() {
    if (!$("compat-search")) return;
    $("compat-search").addEventListener("input", (event) => { state.query = event.target.value; paintGames(); });
    $("compat-device").addEventListener("change", (event) => { state.device = event.target.value; paintGames(); });
    $("compat-status").addEventListener("click", (event) => {
      const button = event.target.closest("button");
      if (!button) return;
      state.status = button.dataset.status;
      for (const other of all("button", $("compat-status"))) other.classList.toggle("on", other === button);
      paintGames();
    });
    $("games-more").addEventListener("click", () => {
      state.more = !state.more;
      paintGames();
      if (!state.more) $("compatibility").scrollIntoView();
    });
  }

  function detail() {
    const dialog = $("detail");
    if (!dialog) return;
    $("detail-close").addEventListener("click", () => dialog.close());
    dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });
    dialog.addEventListener("close", () => { state.detail = null; $("detail-videos").textContent = ""; });
    if ($("videos-more")) $("videos-more").addEventListener("click", () => { state.films += FIRST_VIDEOS; paintVideos(); });
  }

  function watch() {
    const reveal = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("in");
        reveal.unobserve(entry.target);
      }
    }, { rootMargin: "0px 0px -8% 0px" });
    for (const node of all(".reveal")) reveal.observe(node);

    const films = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const video = entry.target;
        if (!entry.isIntersecting) { video.pause(); continue; }
        if (!video.src) video.src = video.dataset.src;
        if (!calm) video.play().catch(() => {});
      }
    }, { rootMargin: "200px 0px" });
    for (const video of all("video[data-src]")) films.observe(video);

    if ($("flaps")) {
      const board = new IntersectionObserver((entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        state.visible = true;
        board.disconnect();
        showStars(state.stars);
      }, { threshold: 0.4 });
      board.observe($("flaps"));
    }
  }

  async function start() {
    menus();
    filters();
    detail();
    watch();
    const lang = detect();
    const [base, live, compat, bench, videos] = await Promise.all([
      json("i18n/en.json").catch(() => ({})),
      json("data/live.json").catch(() => null),
      json("data/compat.json?v=5").catch(() => null),
      json("data/bench.json").catch(() => []),
      fetch("data/videos.json", { cache: "no-cache" }).then((response) => response.json()).catch(() => [])
    ]);
    Object.assign(state, { base, strings: base, live, compat, bench, videos });
    await setLang(lang, false);
    if (!live) return;
    showStars(live.stars);
    refresh();
    latest();
    crowd();
    setInterval(refresh, 120000);
    document.addEventListener("visibilitychange", refresh);
  }

  start();
})();
