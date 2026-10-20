#!/usr/bin/env node
/**
 * Interactive publisher for the solver registry (Nostr kind 38389).
 *
 * Wraps the compiled CLI modules so an operator can, in one run:
 *   1. paste the coordinator nsec (masked, never echoed or written to disk),
 *   2. say how many solvers there are,
 *   3. paste each solver npub (validated as it is typed),
 *   4. review a summary and confirm before anything is published.
 *
 * The coordinator is always added to the list, so it can resolve disputes
 * itself. Duplicates are collapsed by the registry builder.
 *
 * Run with:  npm run publish:interactive
 *            node scripts/publish-interactive.mjs
 */
import { createInterface } from "node:readline";
import { stdin, stdout, stderr } from "node:process";
import { getPublicKey } from "nostr-tools/pure";
import { nip19 } from "nostr-tools";
import { pubkeyFromInput, secretKeyFromInput } from "../dist/pubkey.js";
import { signRegistry, publishEvent } from "../dist/registry.js";
import { resolveRelays } from "../dist/relays.js";

const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";
const RESET = "\x1b[0m";

const rl = createInterface({ input: stdin, output: stdout });

/** Prompt a line (echoing what is typed). */
function ask(question) {
  return new Promise((resolve) => rl.question(question, (answer) => resolve(answer)));
}

/**
 * Prompt a line but echo `*` per character instead of the input, so the nsec
 * never lands on screen. Works over `readline` (no raw-mode juggling).
 */
function askMasked(question) {
  stdout.write(question);
  if (!stdin.isTTY) return ask("");
  const rlAny = rl;
  const original = rlAny._writeToOutput?.bind(rlAny);
  rlAny._writeToOutput = (str) => {
    // Keep the prompt/control sequences, mask the typed characters.
    if (str.includes("\n") || str.includes("\r")) stdout.write(str);
    else stdout.write("*");
  };
  return ask("").then((answer) => {
    if (original) rlAny._writeToOutput = original;
    stdout.write("\n");
    return answer;
  });
}

/** Hex of the coordinator key, derived from its nsec/hex secret. */
function coordinatorHexFromSecret(secret) {
  const skHex = secretKeyFromInput(secret);
  return getPublicKey(Uint8Array.from(Buffer.from(skHex, "hex")));
}

function npubOf(hex) {
  return nip19.npubEncode(hex);
}

async function main() {
  stdout.write(`\n${BOLD}${CYAN}Publicar registro de solvers (Nostr kind 38389)${RESET}\n`);
  stdout.write(`${DIM}El coordinador firma el evento y queda incluido como solver.${RESET}\n\n`);

  // 1. Coordinator secret.
  let secret = "";
  let coordinatorHex = "";
  for (;;) {
    const answer = (await askMasked("nsec del coordinador (oculta): ")).trim();
    if (!answer) {
      stdout.write(`${RED}La nsec no puede estar vacía.${RESET}\n`);
      continue;
    }
    try {
      secret = answer;
      coordinatorHex = coordinatorHexFromSecret(secret);
      break;
    } catch (error) {
      stdout.write(
        `${RED}nsec inválida: ${error instanceof Error ? error.message : String(error)}${RESET}\n`,
      );
    }
  }
  stdout.write(
    `${DIM}coordinador: ${RESET}${npubOf(coordinatorHex)}\n${DIM}             ${coordinatorHex}${RESET}\n\n`,
  );

  // 2. How many solvers.
  let extraCount = 0;
  for (;;) {
    const answer = (await ask("¿Cuántos solvers habrá (además del coordinador)?: ")).trim();
    if (/^\d+$/.test(answer)) {
      extraCount = Number.parseInt(answer, 10);
      break;
    }
    stdout.write(`${RED}Escribe un número entero (0 para solo el coordinador).${RESET}\n`);
  }

  // 3. Each solver npub, validated on entry.
  const solvers = [coordinatorHex];
  for (let i = 1; i <= extraCount; i++) {
    for (;;) {
      const raw = (await ask(`npub/hex del solver ${i}: `)).trim();
      if (!raw) {
        stdout.write(`${RED}Valor vacío.${RESET}\n`);
        continue;
      }
      try {
        const hex = pubkeyFromInput(raw);
        solvers.push(hex);
        stdout.write(`  ${DIM}→ ${hex}${RESET}\n`);
        break;
      } catch (error) {
        stdout.write(
          `${RED}npub/hex inválida: ${error instanceof Error ? error.message : String(error)}${RESET}\n`,
        );
      }
    }
  }

  // 4. Sign and review.
  const event = signRegistry({ solvers }, secret);
  const unique = event.tags.filter((t) => t[0] === "s").map((t) => t[1]);

  stdout.write(`\n${BOLD}Resumen${RESET}\n`);
  stdout.write(`  kind: ${event.kind}\n`);
  stdout.write(`  d:    ${JSON.stringify(event.tags.find((t) => t[0] === "d")?.[1])}\n`);
  stdout.write(`  solvers (${unique.length}, deduplicados):\n`);
  for (const hex of unique) {
    stdout.write(`    • ${hex}${hex === coordinatorHex ? `  ${DIM}(coordinador)${RESET}` : ""}\n`);
  }
  stdout.write(`  relays: ${resolveRelays().join(", ")}\n`);
  stdout.write(`  event id: ${event.id}\n\n`);

  const confirm = (await ask(`¿Publicar? ${DIM}(s/N, o "d" para dry-run)${RESET} `)).trim().toLowerCase();
  if (confirm === "d") {
    stdout.write(`\n${DIM}--dry-run: evento firmado (no publicado):${RESET}\n`);
    stdout.write(`${JSON.stringify(event, null, 2)}\n`);
    return;
  }
  if (!["s", "si", "y", "yes"].includes(confirm)) {
    stdout.write(`${YELLOW}Cancelado, no se publicó nada.${RESET}\n`);
    return;
  }

  // 5. Publish.
  const relays = resolveRelays();
  stdout.write(`\nPublishing to ${relays.length} relay(s)…\n`);
  try {
    const accepted = await publishEvent(event, relays);
    for (const relay of accepted) stdout.write(`  ${GREEN}✓${RESET} ${relay}\n`);
    stdout.write(`\n${GREEN}${BOLD}Publicado.${RESET} event id ${event.id}\n`);
    stdout.write(
      `${DIM}Nota: reemplaza el registro previo (misma d). Recarga el cliente si no se actualiza en vivo.${RESET}\n`,
    );
  } catch (error) {
    stderr.write(
      `${RED}error al publicar: ${error instanceof Error ? error.message : String(error)}${RESET}\n`,
    );
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    stderr.write(`error: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  })
  .finally(() => {
    rl.close();
  });
