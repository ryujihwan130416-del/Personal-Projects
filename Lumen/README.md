# Lumen

Search YouTube by the details that usually take a pile of menus: length, upload date, quality, captions, license, category, language, region, channel, and live broadcasts. Pick a result and it plays in the page.

Without an API key, Lumen searches a built-in sample catalog so the filters and player are usable immediately. Durations and statistics in that catalog are approximate. Add a YouTube Data API v3 key to search the live index.

## Run

```bash
cd Lumen
npm install
npm run dev
```

Open the URL Vite prints (http://localhost:5173).

`npm test` checks the query builder and the sample search. `npm run build` typechecks and writes `dist/`.

## API key

1. In Google Cloud, enable [YouTube Data API v3](https://console.cloud.google.com/apis/library/youtube.googleapis.com).
2. Create an API key and restrict it to that API.
3. For local development, allow the referrer `http://localhost:5173/*`.
4. Either paste the key into **Add API key** (stored in this browser only) or put it in `.env`:

```bash
cp .env.example .env
```

```
VITE_YOUTUBE_API_KEY=your-key
```

Restart the dev server after changing `.env`. A key saved in the browser overrides the environment variable.

A search costs about 100 quota units, plus a small call when a channel name has to be resolved. The default daily quota is 10,000 units.

## Search

- Type a channel name, `@handle`, or `UC…` id to list that creator’s public uploads, newest first. Use **Search as a keyword** if you wanted videos that merely mention the name.
- Any other query searches videos. You can still narrow by channel in the filter column.
- Set filters before or after the first search. After a search, changing a filter runs again.
- **Broadcast** (live, upcoming, replay) cannot be combined with length, quality, captions, license, dimension, category, or embeddable. YouTube rejects that combination, so those controls pause.
- Region and language bias the ranking. They do not drop videos from other places.
- `/` focuses the search box. `Esc` closes the player and the mobile filter drawer.

## Keyboard and layout

The filter column stays on screen on a wide window and becomes a drawer on a narrow one. Choosing a video opens a player beside the results, or as a sheet on a smaller window.
