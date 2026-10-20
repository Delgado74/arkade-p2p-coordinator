import { test } from "node:test";
import assert from "node:assert/strict";
import { getPublicKey, verifyEvent } from "nostr-tools/pure";
import { pubkeyFromInput, secretKeyFromInput } from "./pubkey.js";
import { buildRegistryTemplate, normalizeSolvers, signRegistry } from "./registry.js";
import { SOLVERS_KIND } from "./schema.js";
import { parseArgs, str } from "./args.js";

const HEX_A = "1b84f2c9b0dcb6a9c1e2f3a4b5c6d7e8f90123456789abcdef0123456789abcd";
const NSEC = "nsec13czzh9dn5hl7ga0qtgzgjukqsq659ljpgrvlusgslpjcty8t82ss3z329g";
const NPUB_OF_NSEC = "npub1783u2xtrv5pvxf80nke96a7nnmdr70dw325565jk8y433qrghnes6yy29n";
const PUB_OF_NSEC = "f1e3c519636502c324ef9db25d77d39eda3f3dae8aa94d5256392b188068bcf3";

test("pubkeyFromInput accepts hex (case-insensitive) and npub", () => {
  assert.equal(pubkeyFromInput(HEX_A.toUpperCase()), HEX_A);
  assert.equal(pubkeyFromInput(NPUB_OF_NSEC), PUB_OF_NSEC);
});

test("pubkeyFromInput rejects garbage", () => {
  assert.throws(() => pubkeyFromInput("npub1bad"));
  assert.throws(() => pubkeyFromInput("not-a-key"));
  assert.throws(() => pubkeyFromInput(""));
});

test("secretKeyFromInput normalizes nsec to the matching hex secret", () => {
  const skHex = secretKeyFromInput(NSEC);
  assert.match(skHex, /^[0-9a-f]{64}$/);
  assert.equal(getPublicKey(Uint8Array.from(Buffer.from(skHex, "hex"))), PUB_OF_NSEC);
  assert.equal(secretKeyFromInput(skHex), skHex);
});

test("normalizeSolvers dedupes and preserves order", () => {
  const out = normalizeSolvers([NPUB_OF_NSEC, HEX_A, PUB_OF_NSEC, HEX_A.toUpperCase()]);
  assert.deepEqual(out, [PUB_OF_NSEC, HEX_A]);
});

test("normalizeSolvers rejects empty", () => {
  assert.throws(() => normalizeSolvers([]));
});

test("buildRegistryTemplate emits d=solvers and one s tag per solver", () => {
  const { template, solvers } = buildRegistryTemplate({ solvers: [NPUB_OF_NSEC], createdAt: 1 });
  assert.equal(template.kind, SOLVERS_KIND);
  assert.deepEqual(template.tags, [["d", "solvers"], ["s", PUB_OF_NSEC]]);
  assert.deepEqual(solvers, [PUB_OF_NSEC]);
});

test("buildRegistryTemplate carries community and name when given", () => {
  const { template } = buildRegistryTemplate({
    solvers: [HEX_A],
    community: "c1",
    name: "Comunidad",
    createdAt: 1,
  });
  assert.deepEqual(template.tags, [
    ["d", "solvers:c1"],
    ["s", HEX_A],
    ["community", "c1"],
    ["name", "Comunidad"],
  ]);
});

test("signRegistry produces a valid signature", () => {
  const event = signRegistry({ solvers: [NPUB_OF_NSEC] }, NSEC);
  assert.equal(event.pubkey, PUB_OF_NSEC);
  assert.equal(verifyEvent(event), true);
});

test("parseArgs handles --flag=value, --flag value, --bool and repeats", () => {
  const { command, flags, lists } = parseArgs([
    "publish",
    "--solvers=a,b",
    "--name",
    "Comunidad",
    "--dry-run",
    "--solver",
    "x",
    "--solver",
    "y",
  ]);
  assert.equal(command, "publish");
  assert.equal(str(flags, "solvers"), "a,b");
  assert.equal(str(flags, "name"), "Comunidad");
  assert.equal(flags["dry-run"], true);
  assert.deepEqual(lists["solver"], ["x", "y"]);
});
