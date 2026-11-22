import { appendFile, readFile, writeFile } from "node:fs/promises";
import { matcher } from "./video-games.mjs";

const API = "https://www.googleapis.com/youtube/v3";
const QUERIES = ["DroidDeck", "\"Droid Deck\" android"];
const OURS = /droid\s?deck/i;
const IMPOSTOR = /droid-?deck\.(?!dev\b)[a-z]{2,}/i;
const KEEP = 300;
const GAME_SEARCHES = 10;
const OUT = new URL("../data/videos.json", import.meta.url);
const STATE = new URL("../data/video-state.json", import.meta.url);
const COMPAT = new URL("../data/compat.json", import.meta.url);
const key = process.env.YOUTUBE_API_KEY || "";
const today = new Date().toISOString().slice(0, 10);
const stats = { units: 0, channels: 0, searches: 0, found: 0, dropped: 0 };

async function json(url, fallback) {
  return JSON.parse(await readFile(url, "utf8").catch(() => JSON.stringify(fallback)));
}

async function yt(path, params, cost = 1) {
  stats.units += cost;
  const res = await fetch(`${API}/${path}?${new URLSearchParams({ ...params, key })}`);
  if (!res.ok) throw new Error(`${res.status} ${path}`);
  return res.json();
}

async function search(q, maxResults) {
  stats.searches++;
  const batch = await yt("search", { part: "id", type: "video", order: "date", maxResults: String(maxResults), q }, 100);
  return batch.items.map((item) => item.id.videoId).filter(Boolean);
}

async function uploads(channelId) {
  stats.channels++;
  const batch = await yt("playlistItems", { part: "snippet", maxResults: "50", playlistId: `UU${channelId.slice(2)}` });
  return batch.items
    .filter((item) => OURS.test(`${item.snippet.title}\n${item.snippet.description}`))
    .map((item) => item.snippet.resourceId.videoId);
}

function length(iso) {
  const [, h = 0, m = 0, s = 0] = iso.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/) || [];
  const pad = (value) => String(value).padStart(2, "0");
  return Number(h) ? `${h}:${pad(m)}:${pad(s)}` : `${Number(m)}:${pad(s)}`;
}

async function details(ids) {
  const found = new Map();
  for (let at = 0; at < ids.length; at += 50) {
    const batch = await yt("videos", { part: "snippet,contentDetails,status", id: ids.slice(at, at + 50).join() });
    for (const item of batch.items) {
      const { title, description, channelTitle, channelId, publishedAt, liveBroadcastContent } = item.snippet;
      const about = `${title}\n${description}`;
      if (!OURS.test(about) || IMPOSTOR.test(about) || !item.status.embeddable || liveBroadcastContent !== "none") continue;
      found.set(item.id, { id: item.id, title, channel: channelTitle, channelId, published: publishedAt, length: length(item.contentDetails.duration) });
    }
  }
  return found;
}

function retag(list, tag) {
  for (const video of list) {
    const games = tag(video.title);
    if (games.length) video.games = games;
    else delete video.games;
  }
}

function trim(list) {
  const sorted = list.sort((a, b) => b.published.localeCompare(a.published) || a.id.localeCompare(b.id));
  const others = sorted.filter((video) => !video.games).slice(0, KEEP);
  return sorted.filter((video) => video.games || others.includes(video));
}

function rotation(names, list, state) {
  const tagged = new Set(list.flatMap((video) => video.games || []));
  return [...names]
    .sort((a, b) => Number(tagged.has(a)) - Number(tagged.has(b)) || (state.checked[a] || "").localeCompare(state.checked[b] || "") || a.localeCompare(b))
    .slice(0, GAME_SEARCHES);
}

async function report(lines) {
  console.log(lines.join("\n"));
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, `\n### Videos\n\n${lines.map((line) => `- ${line}`).join("\n")}\n`);
}

async function main() {
  const compat = await json(COMPAT, { games: [], devices: [] });
  const names = compat.games.map((game) => game.name);
  const tag = matcher(names, compat.devices.map((device) => device.name));
  const known = await json(OUT, []);
  const state = { searched: "", checked: {}, ...(await json(STATE, {})) };

  if (!key) {
    retag(known, tag);
    await writeFile(OUT, `${JSON.stringify(trim(known), null, 1)}\n`);
    await report(["YOUTUBE_API_KEY is not set, no API calls made; game tags refreshed from data/compat.json."]);
    return;
  }

  const ids = new Set(known.map((video) => video.id));
  const channels = [...new Set(known.map((video) => video.channelId).filter(Boolean))];
  for (const channelId of channels) {
    for (const id of await uploads(channelId).catch(() => [])) ids.add(id);
  }
  const searched = [];
  if (state.searched !== today) {
    for (const q of QUERIES) for (const id of await search(q, 50)) ids.add(id);
    for (const name of rotation(names, known, state)) {
      for (const id of await search(`DroidDeck "${name}"`, 25)) ids.add(id);
      state.checked[name] = today;
      searched.push(name);
    }
    state.searched = today;
  }

  const fresh = await details([...ids]);
  const before = new Set(known.map((video) => video.id));
  stats.found = [...fresh.keys()].filter((id) => !before.has(id)).length;
  stats.dropped = [...before].filter((id) => !fresh.has(id)).length;
  const list = [...fresh.values()];
  retag(list, tag);
  const kept = trim(list);
  await writeFile(OUT, `${JSON.stringify(kept, null, 1)}\n`);
  await writeFile(STATE, `${JSON.stringify({ searched: state.searched, checked: Object.fromEntries(Object.entries(state.checked).filter(([name]) => names.includes(name)).sort()) }, null, 1)}\n`);
  const games = new Set(kept.flatMap((video) => video.games || []));
  await report([
    `API key present: yes`,
    `Units used: ${stats.units} (uploads playlists ${stats.channels}, searches ${stats.searches})`,
    `Videos checked: ${ids.size}, new: ${stats.found}, gone or filtered: ${stats.dropped}`,
    `Videos kept: ${kept.length}, tagged with a game: ${kept.filter((video) => video.games).length} across ${games.size} games`,
    searched.length ? `Game searches: ${searched.join(", ")}` : "Game searches: already done today",
  ]);
}

main().catch(async (error) => {
  await report([`Video refresh failed: ${error.message}`, `Units used before failure: ${stats.units}`]);
  process.exit(1);
});
