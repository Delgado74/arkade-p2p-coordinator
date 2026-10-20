import { finalizeEvent, type Event, type EventTemplate } from "nostr-tools/pure";
import { SimplePool } from "nostr-tools/pool";
import { pubkeyFromInput, secretKeyFromInput, type HexPubKey } from "./pubkey.js";
import { SOLVERS_KIND, solversDTag } from "./schema.js";

/** Input for building a solver registry event. */
export interface RegistryInput {
  /** Solver identifiers (npub or hex). Duplicates and case are normalized. */
  solvers: string[];
  /** Optional community id; stage 1 keeps a single shared list. */
  community?: string;
  /** Optional human-readable community name. */
  name?: string;
  /** Unix seconds; defaults to now. NIP-33 uses this to resolve the latest. */
  createdAt?: number;
}

/** A built, unsigned registry event plus its normalized solver list. */
export interface BuiltRegistry {
  template: EventTemplate;
  solvers: HexPubKey[];
}

/**
 * Normalize and deduplicate solver identifiers into x-only hex pubkeys,
 * preserving input order. Empty input is rejected.
 */
export function normalizeSolvers(solvers: string[]): HexPubKey[] {
  const seen = new Set<string>();
  const out: HexPubKey[] = [];
  for (const raw of solvers) {
    const hex = pubkeyFromInput(raw);
    if (seen.has(hex)) continue;
    seen.add(hex);
    out.push(hex);
  }
  if (out.length === 0) throw new Error("at least one solver pubkey is required");
  return out;
}

/** Build the unsigned NIP-33 solver registry event template. */
export function buildRegistryTemplate(input: RegistryInput): BuiltRegistry {
  const solvers = normalizeSolvers(input.solvers);
  const tags: string[][] = [
    ["d", solversDTag(input.community)],
    ...solvers.map((hex) => ["s", hex]),
  ];
  if (input.community?.trim()) tags.push(["community", input.community.trim()]);
  if (input.name?.trim()) tags.push(["name", input.name.trim()]);
  return {
    template: {
      kind: SOLVERS_KIND,
      created_at: input.createdAt ?? Math.floor(Date.now() / 1000),
      tags,
      content: "",
    },
    solvers,
  };
}

/** Sign the registry with the coordinator's secret key (nsec or hex). */
export function signRegistry(input: RegistryInput, secret: string): Event {
  const sk = secretKeyFromInput(secret);
  const { template } = buildRegistryTemplate(input);
  return finalizeEvent(template, Uint8Array.from(Buffer.from(sk, "hex")));
}

/**
 * Publish a signed event to the given relays. Succeeds if at least one relay
 * accepts it; otherwise throws with the per-relay reasons.
 */
export async function publishEvent(event: Event, relays: string[]): Promise<string[]> {
  if (relays.length === 0) throw new Error("no relays configured");
  const pool = new SimplePool();
  try {
    const results = await Promise.allSettled(pool.publish(relays, event));
    const accepted: string[] = [];
    const failed: string[] = [];
    results.forEach((r, i) => {
      const relay = relays[i] ?? "?";
      if (r.status === "fulfilled") accepted.push(relay);
      else failed.push(`${relay} (${r.reason instanceof Error ? r.reason.message : String(r.reason)})`);
    });
    if (accepted.length === 0) {
      throw new Error(`no relay accepted the event:\n  ${failed.join("\n  ")}`);
    }
    return accepted;
  } finally {
    pool.close(relays);
  }
}
