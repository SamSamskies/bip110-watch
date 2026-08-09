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

## Data loading

Topology is fetched once on page load (orange tips + fork.observer DAG). There is no background polling — reload the page for a fresh snapshot. Esplora is used once as a fallback only if both proxies fail. Vercel CDN caches proxy responses briefly (`/proxy/orange` ~10s, `/proxy/fork` ~60s) so concurrent viewers share origin fetches.

## Disclaimer

Not affiliated with Coinkite, Bitcoin Core, or Bitcoin Knots. Public monitoring only.

## License

MIT
