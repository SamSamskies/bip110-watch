# BIP-110 Watch

Live **fork topology** visualizer for BIP-110 (standard vs BIP-110 tips).

Not another signaling dashboard — [orange.surf](https://bip110.orange.surf/live.html) already does that. This app focuses on a branching chain diagram: shared history → common ancestor → standard / BIP-110 lanes.

## Develop

```bash
npm install
npm run dev
```

Open the URL Vite prints. Proxies:

| Browser path | Upstream |
|--------------|----------|
| `/proxy/orange/*` | `https://bip110.orange.surf/api/*` |
| `/proxy/fork/*` | `https://fork.observer/api/*` |

```bash
npm test
npm run build
```

## Deploy

Static `dist/` on Vercel. [`vercel.json`](vercel.json) rewrites the same proxy paths.

## Polling

| Feed | Interval |
|------|----------|
| orange `/nodes` | ~15s |
| fork.observer `/{id}/data.json` | ~90s |
| Esplora (fallback only) | ~60s |

Polling pauses while the tab is hidden and resumes (with an immediate refresh) when visible again. Last-good topology is kept if a poll fails. Vercel CDN caches proxy responses briefly (`/proxy/orange` ~10s, `/proxy/fork` ~60s) so concurrent viewers share origin fetches.

## Disclaimer

Not affiliated with Coinkite, Bitcoin Core, or Bitcoin Knots. Public monitoring only.

## License

MIT
