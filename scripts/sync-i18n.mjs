import { readFile, writeFile, readdir } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const read = async (path) => JSON.parse(await readFile(new URL(path, root), "utf8"));
const escape = (text) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const holes = (text) => (text.match(/\{\w+\}/g) || []).sort().join();

const en = await read("i18n/en.json");
const live = await read("data/live.json");
const number = (value, options) => new Intl.NumberFormat("en", options).format(value);
const date = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(live.release.published));
const vars = { version: live.release.tag, date, n: number(live.contributors.length), members: number(live.discord.members), online: number(live.discord.online) };
const values = {
  version: live.release.tag,
  date,
  size: number(live.release.size / 1048576, { style: "unit", unit: "megabyte", maximumFractionDigits: 0 }),
  downloads: number(live.downloads),
  "downloads-short": number(live.downloads, { notation: "compact", maximumFractionDigits: 2 }),
  rank: number(live.rank),
  forks: number(live.forks),
  people: number(live.contributors.length)
};
const text = (key) => {
  if (!(key in en)) throw new Error(`Unknown string ${key}`);
  return escape(en[key].replace(/\{(\w+)\}/g, (whole, name) => vars[name] ?? whole));
};

for (const page of ["index.html", "404.html"]) {
  const before = await readFile(new URL(page, root), "utf8");
  let html = before.replace(/(<[^<>]*\sdata-i18n="([^"]+)"[^<>]*>)[^<]*(<)/g, (whole, open, key, close) => `${open}${text(key)}${close}`);
  html = html.replace(/(<[^<>]*\sdata-live="([^"]+)"[^<>]*>)[^<]*(<)/g, (whole, open, key, close) => `${open}${escape(values[key])}${close}`);
  html = html.replace(/<[^<>]*\sdata-i18n-attr="([^"]+)"[^<>]*>/g, (tag, pairs) => {
    for (const pair of pairs.split(";")) {
      const [attr, key] = pair.split(":");
      const filled = `${attr}="${text(key)}"`;
      const present = new RegExp(`\\s${attr}="[^"]*"`);
      tag = present.test(tag) ? tag.replace(present, ` ${filled}`) : tag.replace(/>$/, ` ${filled}>`);
    }
    return tag;
  });
  if (html !== before) await writeFile(new URL(page, root), html);
}

let broken = 0;
for (const file of await readdir(new URL("i18n/", root))) {
  if (file === "en.json" || !file.endsWith(".json")) continue;
  const locale = await read(`i18n/${file}`);
  for (const key of Object.keys(en)) {
    if (!(key in locale)) { console.error(`${file}: missing ${key}`); broken++; continue; }
    if (holes(locale[key]) !== holes(en[key])) { console.error(`${file}: placeholders differ in ${key}`); broken++; }
  }
  for (const key of Object.keys(locale)) if (!(key in en)) { console.error(`${file}: unknown ${key}`); broken++; }
}
if (broken) process.exit(1);
