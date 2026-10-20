#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { list, parseArgs, str } from "./args.js";
import { resolveRelays } from "./relays.js";
import { buildRegistryTemplate, publishEvent, signRegistry, type RegistryInput } from "./registry.js";

const USAGE = `arkade-p2p-coordinator — publish the solver registry (Nostr kind 38389)

Usage:
  arkade-p2p-coordinator publish [options]

Options:
  --solvers <npub,npub,...>   Comma-separated solver npubs or hex keys (repeatable via --solver).
  --solver <npub|hex>         Add one solver (may be repeated).
  --file <path>               Read solver npubs/hex from a file (one per line, # comments ok).
  --community <id>            Optional community id (stage 2).
  --name <name>               Optional community name.
  --relays <wss://a,wss://b>  Relays to publish to (default: ../../relays.ts defaults or NOSTR_RELAYS).
  --secret <nsec|hex>         Coordinator secret key. Prefer --secret-file or NOSTR_SECRET.
  --secret-file <path>        File containing the nsec/hex (whitespace trimmed).
  --dry-run                   Print the signed event without publishing.

Environment:
  NOSTR_SECRET   Coordinator nsec/hex (used when --secret/--secret-file are absent).
  NOSTR_RELAYS   Comma-separated relay list fallback.

Examples:
  arkade-p2p-coordinator publish --file solvers.txt --secret-file ~/.mostro/coordinator.nsec
  arkade-p2p-coordinator publish --solvers npub1...,npub1... --dry-run
`;

function collectSolvers(
  flags: Record<string, string | boolean>,
  lists: Record<string, string[]>,
): string[] {
  const out: string[] = [];
  const csv = str(flags, "solvers");
  if (csv) out.push(...csv.split(","));
  // `--solver` is repeatable.
  out.push(...list(lists, "solver"));
  const file = str(flags, "file");
  if (file) {
    const text = readFileSync(file, "utf8");
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.split("#")[0]!.trim();
      if (trimmed) out.push(trimmed);
    }
  }
  const cleaned = out.map((s) => s.trim()).filter(Boolean);
  if (cleaned.length === 0) {
    throw new Error("no solvers given: use --solvers, --solver or --file");
  }
  return cleaned;
}

function readSecret(flags: Record<string, string | boolean>): string {
  const inline = str(flags, "secret");
  if (inline && inline !== "") return inline;
  const file = str(flags, "secret-file");
  if (file) return readFileSync(file, "utf8").trim();
  const env = process.env.NOSTR_SECRET?.trim();
  if (env) return env;
  throw new Error("no secret: use --secret, --secret-file or NOSTR_SECRET");
}

async function main(): Promise<void> {
  const { command, flags, lists } = parseArgs(process.argv.slice(2));
  if (command !== "publish") {
    process.stdout.write(USAGE);
    process.exitCode = command === "" || command === "help" ? 0 : 1;
    return;
  }

  const solvers = collectSolvers(flags, lists);
  const input: RegistryInput = {
    solvers,
    community: str(flags, "community") || undefined,
    name: str(flags, "name") || undefined,
  };
  const secret = readSecret(flags);
  const event = signRegistry(input, secret);
  const { solvers: normalized } = buildRegistryTemplate(input);

  process.stdout.write(
    `Registry: kind ${event.kind}, d=${JSON.stringify(
      event.tags.find((t) => t[0] === "d")?.[1],
    )}, ${normalized.length} solver(s)\n`,
  );
  for (const hex of normalized) process.stdout.write(`  • ${hex}\n`);

  if (flags["dry-run"] === true) {
    process.stdout.write("\n--dry-run: signed event (not published):\n");
    process.stdout.write(`${JSON.stringify(event, null, 2)}\n`);
    return;
  }

  const relays = resolveRelays(str(flags, "relays"));
  process.stdout.write(`\nPublishing to ${relays.length} relay(s)…\n`);
  const accepted = await publishEvent(event, relays);
  for (const relay of accepted) process.stdout.write(`  ✓ ${relay}\n`);
  process.stdout.write(`\nPublished event id ${event.id}\n`);
}

// nostr-tools' pool can emit an unhandled rejection on WebSocket failures
// (e.g. a relay refusing the connection). Surface it as a clean message
// instead of letting Node crash on it; the per-relay result is already
// reported by publishEvent.
process.on("unhandledRejection", (reason: unknown) => {
  process.stderr.write(
    `relay error: ${reason instanceof Error ? reason.message : String(reason)}\n`,
  );
  process.exitCode = 1;
});

main().catch((error: unknown) => {
  process.stderr.write(`error: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
