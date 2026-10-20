import { bech32 } from "@scure/base";

/** x-only hex pubkey (64 lowercase hex chars). */
export type HexPubKey = string;

const HEX64 = /^[0-9a-fA-F]{64}$/;

/**
 * Normalize a solver identifier (npub or hex) to a lowercase x-only hex pubkey.
 *
 * BIP-340 x-only keys are the same value encoded in both forms, so an `npub`
 * is just the bech32 encoding of the 32 raw bytes. We accept either.
 *
 * @throws if the value is neither a valid 64-hex string nor a valid `npub`.
 */
export function pubkeyFromInput(input: string): HexPubKey {
  const value = input.trim();
  if (value.length === 0) throw new Error("empty pubkey");
  if (HEX64.test(value)) return value.toLowerCase();
  if (value.toLowerCase().startsWith("npub1")) {
    const decoded = bech32.decode(value as `${string}1${string}`, 5000);
    if (decoded.prefix !== "npub") throw new Error(`not an npub: ${value}`);
    const bytes = bech32.fromWords(decoded.words);
    if (bytes.length !== 32) throw new Error(`npub is not a 32-byte key: ${value}`);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  }
  throw new Error(`not a pubkey (expected npub or 64-hex): ${value}`);
}

/** Normalize an nsec (bech32) or 64-hex secret key to a hex secret key. */
export function secretKeyFromInput(input: string): string {
  const value = input.trim();
  if (value.length === 0) throw new Error("empty secret key");
  if (HEX64.test(value)) return value.toLowerCase();
  if (value.toLowerCase().startsWith("nsec1")) {
    const decoded = bech32.decode(value as `${string}1${string}`, 5000);
    if (decoded.prefix !== "nsec") throw new Error("not an nsec");
    const bytes = bech32.fromWords(decoded.words);
    if (bytes.length !== 32) throw new Error("nsec is not a 32-byte key");
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  }
  throw new Error("secret key must be an nsec or 64-hex");
}
