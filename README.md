# arkade-p2p-coordinator

Small CLI for a **community coordinator** to publish the solver registry that
[`arkade-p2p-nostr`](https://github.com/Delgado74/arkade-p2p-nostr) clients read.

The registry is a single Nostr event. Clients use it to decide which keys may
act as **solvers** (resolve escrow disputes) for that community. Publishing is
write-only: this tool never trades, holds funds, or signs anything but the
registry.

## The event

A NIP-33 replaceable event, kind `38389`, signed by the coordinator:

```jsonc
{
  "kind": 38389,
  "tags": [
    ["d", "solvers"],              // addressable id (stage 1: one shared list)
    ["s", "<64-hex solver pubkey>"], // one per solver (npub accepted on input)
    ["s", "<64-hex solver pubkey>"],
    ["community", "<id>"],         // optional (stage 2)
    ["name", "<community name>"]   // optional
  ],
  "content": ""
}
```

- The `d` tag is the NIP-33 identity of the list. Stage 1 uses the single
  `solvers` id. Passing `--community <id>` produces `d = "solvers:<id>"` and a
  `["community","<id>"]` tag, which is the forward-compatible path for
  per-community lists.
- **Only the coordinator's key can publish it.** Clients filter by
  `authors:[<coordinator npub>]`, so the event is ignored unless it is signed by
  the coordinator the client is configured with.
- **Only listed keys are solvers.** A client whose key is not in this list
  hides the Disputas screen entirely; there is no self opt-in.

Solver keys are x-only pubkeys. Both `npub` and 64-hex forms are accepted on
input and normalized to lowercase hex in the event.

## Install

```bash
pnpm install
pnpm build      # compiles src/ to dist/
pnpm test       # unit tests for parsing, normalization and signing
```

## Usage

```bash
node dist/index.js publish [options]
```

Options:

| Flag | Description |
| --- | --- |
| `--solvers <a,b,...>` | Comma-separated solver npubs or hex keys |
| `--solver <npub|hex>` | Add one solver; repeatable |
| `--file <path>` | Read solvers from a file (one per line, `#` comments) |
| `--community <id>` | Community id (stage 2); sets `d = solvers:<id>` |
| `--name <name>` | Human-readable community name |
| `--relays <a,b>` | Relay list (defaults to the client's defaults) |
| `--secret <nsec|hex>` | Coordinator secret key (prefer `--secret-file`/env) |
| `--secret-file <path>` | File containing the nsec/hex |
| `--dry-run` | Print the signed event without publishing |

The secret can also come from the `NOSTR_SECRET` environment variable, and the
relay list from `NOSTR_RELAYS`.

## Examples

Publish from a file, dry-run first to inspect the event:

```bash
node dist/index.js publish --file solvers.txt --secret-file ~/.mostro/coordinator.nsec --dry-run
node dist/index.js publish --file solvers.txt --secret-file ~/.mostro/coordinator.nsec
```

Inline solvers (npub or hex):

```bash
node dist/index.js publish \
  --solvers npub1wr9hjdry05jnu7alfym5yv5ygpnkae0a7hxpv496vw8v4mrgddwsa6rq70 \
  --secret-file ~/.mostro/coordinator.nsec
```

Via environment (no key on the command line):

```bash
export NOSTR_SECRET=$(cat ~/.mostro/coordinator.nsec)
node dist/index.js publish --solver npub1... --community mi-comunidad --name "Mi Comunidad"
```

## Security

- The coordinator key controls who can resolve disputes. Keep the nsec offline:
  pass it via `--secret-file` or `NOSTR_SECRET`, never commit it. `.gitignore`
  already excludes `.env`, `*.nsec` and secret-named files.
- Publishing a new registry does **not** change existing trades: each escrow
  commits its solver set at creation (inside the signed agreement on the
  client). The registry only affects **new** operations.
- Anyone in the list has real spending authority over new escrows, so the list
  is a trust boundary. Publish mindfully.

## Keeping in sync with the client

The client parses this event in `src/lib/protocol.ts` (`SOLVERS_KIND`,
`parseSolverRegistry`) and reads it in `src/lib/nostr.ts` (`fetchSolvers`,
`subscribeSolvers`), filtered by `d = "solvers"` and the coordinator author. If
the tag layout changes here, mirror it there. Stage 2 (per-community `d` ids)
must be applied on both sides together.
