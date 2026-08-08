---
name: btc-esplora-verify
description: >-
  Verify Bitcoin tip/blocks via public Esplora APIs with host rotation. Use for
  bip110-watch fallback path or ad-hoc chain checks — not as the primary BIP-110
  dual-tip source (use orange.surf / fork.observer for that).
---

# BTC Esplora Verify (bip110-watch)

## Hosts & pacing

Browser / app probe order (`ESPLORA_HOSTS` in `src/lib/types.ts`):

1. `https://mempool.bitaroo.net`
2. `https://mempool.emzy.de`
3. `https://mempool.space`
4. `https://blockstream.info`

- Pace ≥400ms between calls to the **same** host for scripts.
- On 429 / 5xx: clear probe, rotate, backoff.
- **Limitation:** Esplora never reports stale/fork blocks — only the active tip.

## Quick recipes

```bash
HOST=https://mempool.bitaroo.net
curl -fsS "$HOST/api/blocks/tip/height"
curl -fsS "$HOST/api/blocks" | head
```

For BIP-110 dual tips and signaling, prefer:

```bash
curl -fsS https://bip110.orange.surf/api/nodes
curl -fsS https://fork.observer/api/1/data.json | head -c 200
```

(Use app proxies `/proxy/orange` and `/proxy/fork` from the browser.)

See also [bip110-fork-monitor](../bip110-fork-monitor/SKILL.md).
