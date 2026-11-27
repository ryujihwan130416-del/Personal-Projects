# Liminal

A cinematic studio: black gate, white hangar, six pinned stills — then you go **inside** a room.

1. **Origin of Light** — 빛의 기원
2. **Weather Inside Me** — 내 안의 날씨
3. **Digital Bloom** — 디지털 블룸
4. **Room of Forgotten Things** — 잊힌 것들의 방
5. **Silent Symphony** — 사일런트 심포니
6. **City as Signal** — 시티 시그널

## Run

```bash
cd Liminal
npm install
npm run dev
```

Open the URL Vite prints (http://localhost:5174). Click **Enter**, scroll the tour, then **들어가기** (or click the still, or keys `1`–`6`) to step into a room. Scroll inside. `Esc` or **Studio** returns. Deep links: `#/origin`, `#/weather`, …

`npm test` checks the catalog, routing, and pin-scroll math. `npm run build` typechecks and writes `dist/`.
