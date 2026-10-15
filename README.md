# DuoHuyGo Xiangqi

A Duolingo-style app for learning Chinese chess (Xiangqi). Runs in desktop and mobile browsers,
installs as a PWA, works offline, and deploys as a static site.

Current state: project scaffold, a fully tested rules engine (`src/engine`), and a board sandbox page.

```sh
npm install
npm run dev     # develop
npm test        # unit + perft tests
npm run build   # static build in dist/
```

See [CLAUDE.md](./CLAUDE.md) for all commands, folder layout and engine conventions.
