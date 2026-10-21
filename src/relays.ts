/** Relays the arkade-p2p-nostr client reads by default (keep in sync). */
export const DEFAULT_RELAYS = [
  "wss://relay.damus.io",
  "wss://nos.lol",
  "wss://relay.primal.net",
  "wss://nostr.mom",
  "wss://offchain.pub",
  "wss://nostr-pub.wellorder.net",
];

/**
 * Resolve the relay list from, in order: `--relays` (comma-separated),
 * `NOSTR_RELAYS` env, or {@link DEFAULT_RELAYS}.
 */
export function resolveRelays(flagValue?: string): string[] {
  const raw = (flagValue && flagValue.trim()) || process.env.NOSTR_RELAYS?.trim() || "";
  const relays = raw
    .split(",")
    .map((r) => r.trim())
    .filter(Boolean);
  return relays.length > 0 ? relays : [...DEFAULT_RELAYS];
}
