---
name: bip110-fork-monitor
description: >-
  BIP-110 fork topology monitor: orange.surf dual tips, fork.observer headers,
  version bit 4, Vercel/Vite proxies, and ForkTopology model. Use when changing
  page-load fetching, topology merge, proxies, or BIP-110 classification in bip110-watch.
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
proxies fail (synthetic agree tip). Do not use Esplora to backfill sparse
fork.observer gaps — show a non-clickable `…+N` chip instead. Esplora follows
one tip and cannot represent the minority BIP-110 chain.

## Classification

BIP-110 signals via version bit **4**: `(nVersion & (1 << 4)) !== 0`.
Constants live in `src/lib/bip110.ts` (mandatory window 961632–963647).

## Topology model

`buildTopology(orange, fork)` in `src/lib/topology.ts`:

1. Tips from orange (preferred) or fork.observer standard / BIP-110 nodes
2. Walk `header_infos` preferring `prev_blockhash` when present, else `prev_id`
   (sparse DAGs often skip intermediate headers but still link via id)
3. Shared path is ancestor-only; topology keeps full post-fork branches
4. UI keeps `BRANCH_HEAD_DISPLAY` (3) blocks after the fork and
   `BRANCH_TIP_DISPLAY` (3) at the tip; middle truncates with dashed `…+N`
   (click to expand/collapse when those headers are known). Height holes in
   fork.observer data get a non-clickable `…+N` between bordering blocks.
   Diagram uses fixed block pixels; desktop is horizontal (scroll-x,
   tip-aligned). Mobile (≤840px) is vertical — shared trunk down,
   STANDARD / BIP-110 columns side by side; diagram grows with the page
   (no nested scroll). Scale up to fill empty canvas width, never scale
   down.
5. `approxReorgChancePercent(Δ)` ≈ `100 / 2^(Δ+1)` — label as approximate

Fixtures: `?mock=forked` / `?mock=agree` / `?mock=long` via `src/data/fixtures.ts`.

## Data loading

- Fetch once on page load (orange + fork in parallel); no background polling
- Esplora fallback once if both proxies fail on that load
- No overlapping in-flight requests; keep last-good orange/fork refs on error
  (a fork 500 must not wipe the DAG down to orange tip-only stubs)
- Vercel: CDN-cache proxies (`orange` ~10s, `fork` ~60s) via `vercel.json` headers

## Attribution

Footer must credit orange.surf and fork.observer. Do not pretend we run the nodes.
