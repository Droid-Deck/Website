import { readFile, writeFile } from "node:fs/promises";

const ORG = "Droid-Deck";
const APP = "DroidDeck";
const OWN_HISTORY = new Set(["DroidDeck", "DroidDeck-Components", "Drivers", "Drivers-CI", "DroidDeck-CI"]);
const SKIP_REPOS = new Set(["decky-loader"]);
const LABELS = { "DroidDeck": "App", "DroidDeck-Proton": "Proton", "DroidDeck-Components": "Components", "Drivers": "Drivers", "Drivers-CI": "Drivers", "DroidDeck-CI": "App", "DD-FEX": "FEX" };
const NOT_PEOPLE = /\[bot\]$|^(weblate|dependabot|github-actions)/i;
const INVITE = "https://discord.com/api/v10/invites/JRGAvawjsm?with_counts=true";
const OUT = new URL("../data/live.json", import.meta.url);
const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN || "";

async function gh(path) {
  const headers = { "Accept": "application/vnd.github+json", "User-Agent": "droid-deck-website" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(path.startsWith("http") ? path : `https://api.github.com/${path}`, { headers });
  if (!res.ok) throw new Error(`${res.status} ${path}`);
  return res.json();
}

async function pages(path, limit = 60) {
  const all = [];
  for (let page = 1; page <= limit; page++) {
    const batch = await gh(`${path}${path.includes("?") ? "&" : "?"}per_page=100&page=${page}`);
    all.push(...batch);
    if (batch.length < 100) break;
  }
  return all;
}

function person(people, user, repo, count) {
  if (!user || user.type !== "User" || NOT_PEOPLE.test(user.login)) return;
  const entry = people.get(user.login) || { login: user.login, avatar: `${user.avatar_url}&s=160`, url: user.html_url, count: 0, areas: [] };
  entry.count += count;
  const area = LABELS[repo] || repo;
  if (!entry.areas.includes(area)) entry.areas.push(area);
  people.set(user.login, entry);
}

async function contributors(repos) {
  const people = new Map();
  for (const repo of repos) {
    if (OWN_HISTORY.has(repo)) {
      for (const user of await pages(`repos/${ORG}/${repo}/contributors`)) person(people, user, repo, user.contributions);
      continue;
    }
    const merged = new Map();
    for (const pull of await pages(`repos/${ORG}/${repo}/pulls?state=closed`)) {
      if (!pull.merged_at || !pull.user) continue;
      const seen = merged.get(pull.user.login) || { user: pull.user, count: 0 };
      seen.count += 1;
      merged.set(pull.user.login, seen);
    }
    for (const { user, count } of merged.values()) person(people, user, repo, count);
  }
  return [...people.values()].sort((a, b) => b.count - a.count || a.login.localeCompare(b.login));
}

async function discord(previous) {
  try {
    const res = await fetch(INVITE, { headers: { "User-Agent": "droid-deck-website" } });
    if (!res.ok) throw new Error(`${res.status} invite`);
    const invite = await res.json();
    return { members: invite.approximate_member_count, online: invite.approximate_presence_count };
  } catch {
    return previous;
  }
}

async function main() {
  let before = {};
  try { before = JSON.parse(await readFile(OUT, "utf8")); } catch {}
  const repo = await gh(`repos/${ORG}/${APP}`);
  const ahead = await gh(`search/repositories?q=${encodeURIComponent(`stars:>${repo.stargazers_count}`)}&per_page=1`);
  const latest = await gh(`repos/${ORG}/${APP}/releases/latest`);
  const releases = await pages(`repos/${ORG}/${APP}/releases`, 5);
  const apk = latest.assets.find((asset) => asset.name === `DroidDeck-${latest.tag_name}.apk`) || latest.assets.find((asset) => asset.name.endsWith(".apk"));
  const names = (await pages(`orgs/${ORG}/repos?type=public`)).filter((entry) => !entry.archived && !SKIP_REPOS.has(entry.name)).map((entry) => entry.name);
  const people = await contributors(names);
  const live = {
    stars: repo.stargazers_count,
    rank: ahead.total_count + 1,
    forks: repo.forks_count,
    downloads: releases.reduce((sum, release) => sum + release.assets.filter((asset) => asset.name.endsWith(".apk")).reduce((part, asset) => part + asset.download_count, 0), 0),
    release: {
      tag: latest.tag_name,
      url: latest.html_url,
      published: latest.published_at,
      size: apk ? apk.size : 0
    },
    discord: await discord(before.discord || { members: 0, online: 0 }),
    contributors: people
  };
  const previous = JSON.stringify({ ...before, updated: undefined });
  if (previous === JSON.stringify({ ...live, updated: undefined })) return;
  await writeFile(OUT, JSON.stringify({ ...live, updated: new Date().toISOString() }, null, 1) + "\n");
}

main().catch((error) => { console.error(error); process.exit(1); });
