import { readFile, writeFile } from "node:fs/promises";

const API = "https://www.googleapis.com/youtube/v3";
const QUERIES = ["DroidDeck", "\"Droid Deck\" android"];
const OURS = /droid\s?deck/i;
const IMPOSTOR = /droid-?deck\.(?!dev\b)[a-z]{2,}/i;
const KEEP = 300;
const PAGES = 3;
const TEXT = 600;
const OUT = new URL("../data/videos.json", import.meta.url);
const key = process.env.YOUTUBE_API_KEY || "";

async function yt(path, params) {
  const res = await fetch(`${API}/${path}?${new URLSearchParams({ ...params, key })}`);
  if (!res.ok) throw new Error(`${res.status} ${path}`);
  return res.json();
}

async function search(q) {
  const ids = [];
  let pageToken = "";
  for (let page = 0; page < PAGES; page++) {
    const params = { part: "id", type: "video", order: "date", maxResults: "50", q };
    if (pageToken) params.pageToken = pageToken;
    const batch = await yt("search", params);
    ids.push(...batch.items.map((item) => item.id.videoId));
    pageToken = batch.nextPageToken || "";
    if (!pageToken) break;
  }
  return ids;
}

function length(iso) {
  const [, h = 0, m = 0, s = 0] = iso.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/) || [];
  const pad = (value) => String(value).padStart(2, "0");
  return Number(h) ? `${h}:${pad(m)}:${pad(s)}` : `${Number(m)}:${pad(s)}`;
}

async function details(ids) {
  const found = [];
  for (let at = 0; at < ids.length; at += 50) {
    const batch = await yt("videos", { part: "snippet,contentDetails,status", id: ids.slice(at, at + 50).join() });
    for (const item of batch.items) {
      const { title, description, channelTitle, publishedAt } = item.snippet;
      const about = `${title}\n${description}`;
      if (!OURS.test(about) || IMPOSTOR.test(about) || !item.status.embeddable) continue;
      found.push({ id: item.id, title, channel: channelTitle, published: publishedAt, length: length(item.contentDetails.duration), text: description.slice(0, TEXT) });
    }
  }
  return found;
}

async function main() {
  if (!key) {
    console.log("YOUTUBE_API_KEY is not set, keeping data/videos.json as it is.");
    return;
  }
  const known = JSON.parse(await readFile(OUT, "utf8").catch(() => "[]"));
  const ids = new Set();
  for (const q of QUERIES) for (const id of await search(q)) ids.add(id);
  const fresh = await details([...ids]);
  const merged = new Map(known.map((video) => [video.id, video]));
  for (const video of fresh) merged.set(video.id, video);
  const list = [...merged.values()].sort((a, b) => b.published.localeCompare(a.published)).slice(0, KEEP);
  await writeFile(OUT, `${JSON.stringify(list, null, 1)}\n`);
  console.log(`${fresh.length} found, ${list.length} kept.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
