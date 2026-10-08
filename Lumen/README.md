# Lumen

Search YouTube by the details that usually take a pile of menus: length, upload date, quality, captions, license, category, language, region, channel, and live broadcasts. Pick a result and it plays in the page.

A normal search looks up public videos on YouTube through the official YouTube Data API. It does not search the built-in sample list.

Without an API key, Lumen cannot call YouTube. The empty screen and a search both say that a YouTube Data API v3 key is required. Paste one into **Add API key** (stored in this browser only) or set `VITE_YOUTUBE_API_KEY`. **Sample** is a separate toggle for the built-in catalog. Durations and statistics there are approximate.

## Run

```bash
cd Lumen
npm install
npm run dev
```

Open the URL Vite prints ([http://localhost:5173](http://localhost:5173)).

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

- Live is the default. A search calls YouTube Data API `search.list` (or a channel’s uploads playlist) and does not return the sample catalog.
- The first screen waits for a search. Results whose titles contain the words come first, and the rest of the real matches follow.
- **Load More** appears at the bottom and requests only the next page.
- A channel name in the channel filter lists that creator’s uploads. **Search as a keyword** goes back to a normal search.
- Set filters before or after the first search. After a search, changing a filter runs again.
- **Broadcast** (live, upcoming, replay) cannot be combined with length, quality, captions, license, dimension, category, or embeddable. YouTube rejects that combination, so those controls pause.
- Region and language bias the ranking. They do not drop videos from other places.
- `/` focuses the search box. `Esc` closes the player and the mobile filter drawer.



## Android APK

`Lumen.apk` is a debug build of the same app, wrapped in an Android WebView. It needs Android 6 or newer. The app opens on a graph page. **Learn more** at the bottom opens the YouTube search.

1. Copy `Lumen.apk` to the phone.
2. Open it and allow installation from this source if Android asks.
3. In the app, add a YouTube Data API key the same way as in the browser. Restrict the key to YouTube Data API v3. An HTTP referrer restriction will block the app; use an Android app restriction for `app.lumen.youtube` or leave the key unrestricted while testing.

Rebuild after web changes:

```bash
cd Lumen
export ANDROID_HOME="$HOME/android-sdk"
npm run apk
```

The new file is `android/app/build/outputs/apk/debug/app-debug.apk`. Copy it over `Lumen.apk` if you want to replace the checked-in build.

## Keyboard and layout

The filter column stays on screen on a wide window and becomes a drawer on a narrow one. Choosing a video opens a player beside the results, or as a sheet on a smaller window.





I made this to watch YT without my mom realizing btw