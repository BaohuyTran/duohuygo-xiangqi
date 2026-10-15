# DuoHuyGo Xiangqi

A Duolingo-style app for learning Chinese chess (Xiangqi). Runs in desktop and mobile browsers,
installs as a PWA, works offline, and deploys as a static site.

Current state: a tested rules engine (`src/engine`) and a lesson system: 6 units / 18 lessons that teach the board,
every piece, check and checkmate, with a Duolingo-style lesson path, in English and Vietnamese.

```sh
npm install
npm run dev     # develop
npm test        # unit + perft tests
npm run build   # static build in dist/
```

See [CLAUDE.md](./CLAUDE.md) for all commands, folder layout and engine conventions.
