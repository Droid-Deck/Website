import { access, readFile, writeFile } from "node:fs/promises";

const ART = "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/";
const STORE = "https://store.steampowered.com/api/appdetails";
const ROOT = new URL("../", import.meta.url);
const FILE = new URL("data/compat.json", ROOT);
const BATCH = 8;

async function loads(url) {
  if (!/^https?:/.test(url)) return access(new URL(url, ROOT)).then(() => true, () => false);
  const res = await fetch(url, { method: "HEAD" }).catch(() => null);
  return Boolean(res?.ok && res.headers.get("content-type")?.startsWith("image/"));
}

async function steamHeader(appid) {
  const res = await fetch(`${STORE}?appids=${appid}&filters=basic`).catch(() => null);
  if (!res?.ok) return "";
  const body = await res.json().catch(() => ({}));
  return body[appid]?.data?.header_image?.split("?")[0] || "";
}

async function check(game) {
  const url = game.art || (game.appid ? `${ART}${game.appid}/header.jpg` : "");
  if (url && await loads(url)) return "";
  const header = game.appid ? await steamHeader(game.appid) : "";
  if (header && header !== url && await loads(header)) {
    game.art = header;
    return "";
  }
  return game.name;
}

async function main() {
  const text = await readFile(FILE, "utf8");
  const data = JSON.parse(text);
  const missing = [];
  for (let i = 0; i < data.games.length; i += BATCH) {
    missing.push(...await Promise.all(data.games.slice(i, i + BATCH).map(check)));
  }
  const out = JSON.stringify(data, null, 1);
  if (out !== text) await writeFile(FILE, out);
  for (const name of missing.filter(Boolean)) console.log(`::warning::No artwork for ${name}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
