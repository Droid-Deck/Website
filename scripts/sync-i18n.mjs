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

const site = "https://droid-deck.dev/";
const faq = Object.keys(en).filter((key) => /^faq\.q\d+$/.test(key)).map((key) => ({
  "@type": "Question",
  name: en[key],
  acceptedAnswer: { "@type": "Answer", text: en[key.replace(".q", ".a")] }
}));
const graph = {
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "WebSite", "@id": `${site}#website`, name: "DroidDeck", alternateName: "Droid Deck", url: site, inLanguage: "en", publisher: { "@id": `${site}#org` } },
    { "@type": "Organization", "@id": `${site}#org`, name: "DroidDeck", url: site, logo: `${site}assets/img/icon-512.png`, sameAs: ["https://github.com/Droid-Deck", "https://github.com/Droid-Deck/DroidDeck", "https://discord.gg/JRGAvawjsm"] },
    { "@type": "SoftwareApplication", "@id": `${site}#app`, name: "DroidDeck", url: site, description: en["meta.desc"], image: `${site}assets/img/og.png`, operatingSystem: "Android 9+", applicationCategory: "GameApplication", softwareVersion: live.release.tag, datePublished: live.release.published.slice(0, 10), license: "https://www.gnu.org/licenses/gpl-3.0.html", downloadUrl: "https://github.com/Droid-Deck/DroidDeck/releases/latest", installUrl: "https://github.com/Droid-Deck/DroidDeck/releases/latest", publisher: { "@id": `${site}#org` }, offers: { "@type": "Offer", price: "0", priceCurrency: "USD" } },
    { "@type": "FAQPage", "@id": `${site}#faq`, mainEntity: faq }
  ]
};
const ld = `<script type="application/ld+json">${JSON.stringify(graph).replace(/</g, "\\u003c")}</script>`;
const map = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${site}</loc><lastmod>${live.release.published.slice(0, 10)}</lastmod></url></urlset>\n`;
if (map !== await readFile(new URL("sitemap.xml", root), "utf8")) await writeFile(new URL("sitemap.xml", root), map);

for (const page of ["index.html", "404.html"]) {
  const before = await readFile(new URL(page, root), "utf8");
  let html = page === "index.html" ? before.replace(/<script type="application\/ld\+json">.*?<\/script>/s, ld) : before;
  html = html.replace(/(<[^<>]*\sdata-i18n="([^"]+)"[^<>]*>)[^<]*(<)/g, (whole, open, key, close) => `${open}${text(key)}${close}`);
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
