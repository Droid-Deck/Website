# Website

The DroidDeck website, served at [droid-deck.dev](https://droid-deck.dev) by GitHub Pages. Plain HTML, CSS and JavaScript. There is no build step.

## Layout

| Path | What it holds |
| --- | --- |
| `index.html` | The page. English text is written into it by `scripts/sync-i18n.mjs`. |
| `i18n/` | One file per language. `en.json` is the source. |
| `data/live.json` | Stars, rank, downloads, latest release, Discord member counts and contributors. Written by `scripts/update-data.mjs`. |
| `data/videos.json` | YouTube videos about DroidDeck, newest first, with the compat games each one shows. Written by `scripts/update-videos.mjs`. |
| `data/video-state.json` | Last search day and per-game search rotation for `scripts/update-videos.mjs`. |
| `data/compat.json` | Community compatibility reports. |
| `data/bench.json` | The devices the team builds on. Add `"from"` for a device its maker sent. |
| `data/partners.json` | The official partners shown under the devices. Each has a name, a link and a logo from `assets/img/`. |
| `assets/` | Styles, script, font, artwork and clips. |

## Working on it

```bash
python3 -m http.server 8080
```

After changing `i18n/en.json`, run:

```bash
node scripts/sync-i18n.mjs
```

It rewrites the English text in the pages and fails if a language is missing a string or a placeholder.

## Live numbers

The `Update live data` workflow runs every six hours, when a change to its scripts lands on `main`, and on demand from the Actions tab. It refreshes `data/live.json` and commits when something changed. A run on any other branch only writes a summary of the result and commits nothing. The page also asks GitHub directly while it is open, so the star counter and the download button follow new stars and new releases without a deploy.

Contributors come from every public repository in the organisation. Repositories with imported upstream history count merged pull requests instead of commits.

## Videos

The same workflow refreshes `data/videos.json` when the repository has a `YOUTUBE_API_KEY` secret (a YouTube Data API v3 key). Each run reads the uploads of every channel already in the list and rechecks all videos in batches of 50. Once a day it also runs the general searches and searches for 10 games in turn, oldest first, with the rotation kept in `data/video-state.json`. That stays under about 1,700 of the 10,000 free units a day. Without the secret no API calls are made and only the game tags are refreshed. Videos are tagged with the compat games named in their title, and every game and device panel shows its matching videos.

## Domain

`CNAME` holds `droid-deck.dev`. Point the apex at GitHub Pages with four `A` records (`185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`) and `www` with a `CNAME` to `droid-deck.github.io`.
