# AGENTS.md — arkade-p2p-coordinator

## Descripción

CLI para que el coordinador de una comunidad publique el registro de solvers
(evento Nostr kind `38389`) que leen los clientes de `arkade-p2p-nostr`. Es
write-only: no comercia, no custodia fondos y no firma nada más que el registro.

## Arquitectura

- `src/index.ts`: entrada CLI, parseo de argumentos, lectura de secretos,
  dry-run y publicación.
- `src/args.ts`: parser de flags (`--flag=value`, `--flag value`, booleanos y
  flags repetibles).
- `src/pubkey.ts`: normalización de `npub`/hex a pubkey x-only y de
  `nsec`/hex a secret key.
- `src/schema.ts`: contrato del evento (kind, `d`, tags `s`, `community`,
  `name`). Mantener en sync con el cliente.
- `src/registry.ts`: construcción, firma y publicación del registro.
- `src/relays.ts`: relays por defecto y resolución de `--relays`/`NOSTR_RELAYS`.
- `src/websocket.ts`: instala `ws` como `globalThis.WebSocket` antes de cargar
  `nostr-tools/pool` (necesario en Node).
- `src/registry.test.ts`: tests de normalización, firma, plantilla y parser.
- `scripts/publish-interactive.mjs`: flujo interactivo de publicación.

## Comandos

```bash
pnpm install
pnpm build                     # tsc -p tsconfig.json
pnpm test                      # build + node --test dist/registry.test.js
pnpm lint                      # oxlint src
node dist/index.js publish ... # CLI
pnpm publish:interactive       # flujo interactivo
```

Antes de cerrar un cambio ejecutar:

```bash
pnpm build && pnpm test && pnpm lint
```

## Formato del registro

Evento NIP-33 replaceable:

```json
{
  "kind": 38389,
  "tags": [
    ["d", "solvers"],
    ["s", "<64-hex solver pubkey>"],
    ["community", "<id opcional>"],
    ["name", "<nombre opcional>"]
  ],
  "content": ""
}
```

- Etapa 1: `d = "solvers"` (lista única compartida).
- Etapa 2: `--community <id>` produce `d = "solvers:<id>"`.
- Los solvers se aceptan como `npub` o hex y se normalizan a hex minúsculo,
  deduplicados y en el orden de entrada.
- Solo la clave del coordinador puede firmar el evento; los clientes filtran por
  `authors` y por `d`.

Si cambia el layout de tags, actualizar a la vez este repo y
`arkade-p2p-nostr/src/lib/protocol.ts` (`SOLVERS_KIND`,
`parseSolverRegistry`).

## Seguridad

- La `nsec` del coordinador controla quién puede resolver disputas. Mantenerla
  offline.
- Preferir `--secret-file` o `NOSTR_SECRET`; evitar `--secret` en terminales o
  historiales.
- Nunca commitear `.env`, `*.nsec`, archivos con “secret” en el nombre ni
  claves reales.
- `.gitignore` ya excluye secretos; no debilitarlo.
- Publicar un registro nuevo no cambia escrows existentes: cada acuerdo fija su
  set de solvers al crearse.
- Cualquier clave listada obtiene autoridad de gasto sobre escrows nuevos: el
  registro es una frontera de confianza.
- `--dry-run` debe seguir mostrando el evento firmado sin publicarlo.

## Convenciones

- ESM, TypeScript estricto, comillas dobles y punto y coma.
- Imports internos con extensión `.js` (NodeNext).
- Mantener el CLI sin dependencias de UI ni estado persistente.
- Mensajes de error claros; no filtrar secretos en errores.
- Tests con `node:test` + `node:assert/strict`.
- `src/websocket.ts` debe importarse antes que cualquier módulo que cargue
  `nostr-tools/pool`.

## Git

- Commits convencionales: `feat(...)`, `fix(...)`, `test(...)`, `chore(...)`.
- No commitear `dist/`, `node_modules/`, `*.tsbuildinfo`, secretos ni `.env`.
- No hacer `push` ni `force-push` sin que el usuario lo pida explícitamente.
