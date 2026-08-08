# BIP-110 Watch

Live **fork topology** visualizer for BIP-110 (Core vs Knots tips).

Not another signaling dashboard — [orange.surf](https://bip110.orange.surf/live.html) already does that. This app focuses on a branching chain diagram: shared history → common ancestor → Core / Knots lanes.

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
| orange `/nodes` | ~8s |
| fork.observer `/{id}/data.json` | ~20s |
| orange `/signaling` | ~5 min |
| Esplora (fallback only) | ~45s |

Last-good topology is kept if a poll fails. Tab must stay open.

## Disclaimer

Not affiliated with Coinkite, Bitcoin Core, or Bitcoin Knots. Public monitoring only.

## License

MIT
