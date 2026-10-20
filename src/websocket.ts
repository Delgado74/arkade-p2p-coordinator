/**
 * WebSocket bootstrap for Node.
 *
 * `nostr-tools`'s `SimplePool` uses `globalThis.WebSocket`. On Node 22 that is
 * the built-in `undici` WebSocket, which crashes this library on relay close
 * with a recursive `onerror`/`close` loop (`RangeError: Maximum call stack
 * size exceeded`, seen in `pool.js`). The `ws` package does not have that
 * problem, so we install it as the global implementation.
 *
 * This module must be imported **before** anything that pulls in
 * `nostr-tools/pool`. ESM runs imports in declaration order, so importing it
 * first in `registry.ts` is enough.
 */
import WS from "ws";

// `ws` is API-compatible with the browser WebSocket for what nostr-tools uses
// (constructor, send, close, onmessage/onopen/onerror/onclose, addEventListener).
// The cast bridges `ws`'s Node types onto the DOM `WebSocket` type the library
// expects.
globalThis.WebSocket = WS as unknown as typeof globalThis.WebSocket;
