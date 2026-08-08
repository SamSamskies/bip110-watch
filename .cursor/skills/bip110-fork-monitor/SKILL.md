---
name: bip110-fork-monitor
description: >-
  BIP-110 fork topology monitor: orange.surf dual tips, fork.observer headers,
  version bit 4, Vercel/Vite proxies, and ForkTopology model. Use when changing
  polling, topology merge, proxies, or BIP-110 classification in bip110-watch.
---

# BIP-110 Fork Monitor

## Product

Window into **standard vs BIP-110** tips during BIP-110 — not a full explorer or
signaling education site (see bip110.orange.surf for that).

Hero UI: common ancestor only → branch → STANDARD / BIP-110 lanes.
Per-block signaling lives in block details, not on the diagram.

## Proxies

Browser never calls orange/fork.observer cross-origin (no CORS).

| Path | Upstream |
|------|----------|
| `/proxy/orange/:path*` | `https://bip110.orange.surf/api/:path*` |
| `/proxy/fork/:path*` | `https://fork.observer/api/:path*` |

Configured in `vercel.json` and `vite.config.ts` `server.proxy`.

## Endpoints

- `GET /proxy/orange/nodes` — `main` + `bip110` tips, `status`, `rejected`, `mandatoryHeight`
- `GET /proxy/orange/signaling` — bit 4 bitmap, pools, `blockIds` for current epoch
- `GET /proxy/fork/1/data.json` — `header_infos` DAG, `nodes[].tips`, countdown

Esplora host rotation (`src/lib/esplora.ts`) is **fallback only** when both
proxies fail. Esplora follows one tip and will not show a minority BIP-110 chain.

## Classification

BIP-110 signals via version bit **4**: `(nVersion & (1 << 4)) !== 0`.
Constants live in `src/lib/bip110.ts` (mandatory window 961632–963647).

## Topology model

`buildTopology(orange, fork)` in `src/lib/topology.ts`:

1. Tips from orange (preferred) or fork.observer standard / BIP-110 nodes
2. Walk `header_infos` via `prev_id` (fallback `prev_blockhash`) to find common ancestor — hash-only walks break on sparse fork.observer DAGs
3. Shared path is ancestor-only; branches capped by `MAX_BRANCH_DISPLAY`
4. `approxReorgChancePercent(Δ)` ≈ `100 / 2^(Δ+1)` — label as approximate

Fixtures: `?mock=forked` / `?mock=agree` via `src/data/fixtures.ts`.

## Polling

- Orange nodes ~15s (small tip payload)
- Fork data ~90s (~100KB DAG; blocks ~10m)
- Pause all intervals while `document.hidden`; refresh on visibility
- No overlapping in-flight requests; keep last-good on error
- Vercel: CDN-cache proxies (`orange` ~10s, `fork` ~60s) via `vercel.json` headers

## Attribution

Footer must credit orange.surf and fork.observer. Do not pretend we run the nodes.
