/**
 * Shared wire format for the solver registry.
 *
 * This is the contract between this coordinator CLI (which publishes) and the
 * `arkade-p2p-nostr` client (which reads). Keep both in sync when it changes.
 *
 * Event: NIP-33 replaceable, kind 38389, signed by the community coordinator.
 *
 *   ["d", "solvers"]                 addressable id (stage 1: a single list)
 *   ["s", "<64-hex solver pubkey>"]  one per solver
 *   ["community", "<id>"]            optional; stage 2 community tag
 *   ["name", "<community name>"]     optional human label
 *
 * In a future stage `d` becomes `solvers:<communityId>` so each community has
 * its own independent list. Stage 1 keeps the single `solvers` list and only
 * carries `community`/`name` as metadata.
 */

/** NIP-33 addressable event kind for the solver registry. */
export const SOLVERS_KIND = 38389;

/** Addressable `d` tag value for the (single, stage 1) registry. */
export const SOLVERS_D_TAG = "solvers";

/** The tag set the client parses; kept explicit so it is easy to audit. */
export interface SolverRegistryTags {
  d: string;
  solvers: string[];
  community?: string;
  name?: string;
}

/**
 * Build the NIP-33 `d` tag for a community. Stage 1 always returns the shared
 * `solvers` id; passing a community id is the forward-compatible path.
 */
export function solversDTag(communityId?: string): string {
  const id = communityId?.trim();
  return id ? `solvers:${id}` : SOLVERS_D_TAG;
}
