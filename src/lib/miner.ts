import pools from '../data/miningPools.json';

type PoolDef = {
  id: number;
  name: string;
  addresses: string[];
  tags: string[];
  link?: string;
};

type TagRule = { re: RegExp; name: string };

let tagRules: TagRule[] | null = null;
let addressToName: Map<string, string> | null = null;

function ensureIndex(): void {
  if (tagRules && addressToName) return;
  tagRules = [];
  addressToName = new Map();
  for (const pool of pools as PoolDef[]) {
    for (const tag of pool.tags) {
      try {
        tagRules.push({ re: new RegExp(tag, 'i'), name: pool.name });
      } catch {
        const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        tagRules.push({ re: new RegExp(escaped, 'i'), name: pool.name });
      }
    }
    for (const addr of pool.addresses) {
      addressToName.set(addr, pool.name);
    }
  }
}

/** Decode scriptsig hex to a printable ASCII probe string. */
export function scriptsigToAscii(hex: string): string {
  let out = '';
  for (let i = 0; i + 1 < hex.length; i += 2) {
    const c = Number.parseInt(hex.slice(i, i + 2), 16);
    if (Number.isNaN(c)) continue;
    out += c >= 32 && c <= 126 ? String.fromCharCode(c) : ' ';
  }
  return out;
}

/**
 * Map coinbase script + payout addresses to a pool name (mempool pools-v2 rules).
 * Returns '' when unknown.
 */
export function identifyMiner(
  scriptsigHex: string,
  payoutAddresses: string[],
): string {
  ensureIndex();
  for (const addr of payoutAddresses) {
    const name = addressToName!.get(addr);
    if (name) return name;
  }
  const ascii = scriptsigToAscii(scriptsigHex);
  for (const { re, name } of tagRules!) {
    if (re.test(ascii)) return name;
  }
  return '';
}
