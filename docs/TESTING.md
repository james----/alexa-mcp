# Testing Guide

This document outlines the testing architecture, suites, protocol conformance, and quality assurance workflows for `alexa-mcp`.

---

## Test Philosophy & Goals

1. **Zero Flakiness & High Speed**: The entire test suite executes in **under 500 milliseconds**, requiring no external Amazon API calls or mock servers.
2. **High Protocol Fidelity**: Tests verify the official Model Context Protocol (MCP) JSON-RPC specification (protocol version `2024-11-05`) using the `@modelcontextprotocol/sdk` client and in-memory transports.
3. **Multi-Transport Verification**: Every transport supported by `alexa-mcp` (Stdio subprocess pipes, Express Streamable HTTP, Legacy Server-Sent Events) is tested against actual protocol requests.
4. **Security Invariant Validation**: Security guarantees (atomic credential writing, file mode `0600`, directory mode `0700`, `macDms` validation) are verified against the real filesystem using temporary directories.

---

## Running Tests

Run the full automated test suite:

```bash
npm test
```

`npm test` automatically runs `npm run build` (`tsc`) first, ensuring type-checking passes before executing the test suites via `tsx --test`.

To run an individual test suite:

```bash
npx tsx --test test/tools.test.ts
npx tsx --test test/stdio-transport.test.ts
npx tsx --test test/server-transport.test.ts
npx tsx --test test/auth-storage.test.ts
```

---

## Test Suites Overview

### 1. Tools Registration & Execution (`test/tools.test.ts`)
- **Transport**: `InMemoryTransport.createLinkedPair()` from `@modelcontextprotocol/sdk/inMemory.js`.
- **Client**: `Client` from `@modelcontextprotocol/sdk/client/index.js`.
- **Coverage**:
  - Verifies that all **19 tools** are registered with non-empty names, descriptions, and valid JSON object input schemas.
  - Tests execution of device discovery tools: `alexa_list_devices`, `alexa_list_smarthome_devices`, `alexa_list_groups`, `alexa_get_volumes`, `alexa_query_device`.
  - Tests control tools: `alexa_announce`, `alexa_text_command`, `alexa_set_volume`, `alexa_do_not_disturb`, `alexa_speak`, `alexa_speak_ssml`.
  - Tests automation and list tools: `alexa_list_routines`, `alexa_execute_routine`, `alexa_list_lists`, `alexa_get_list_items`, `alexa_add_list_item`.
  - Tests room/group management: `alexa_create_group`, `alexa_update_group`, `alexa_delete_group`.
  - Tests error encapsulation: when `AlexaClient` methods reject, the MCP tool returns `{ isError: true, content: [{ type: "text", text: "Error: ..." }] }`.
  - Tests schema validation rejection: passing invalid arguments (e.g. `volume: 150` which violates `max(100)`) returns an MCP error `-32602` with `isError: true`.

### 2. Stdio Server Transport (`test/stdio-transport.test.ts`)
- **Transport**: Real Node.js child processes spawned over OS standard I/O pipes (`child_process.spawn`).
- **Coverage**:
  - **Backward-Compatibility Shim**: Tests spawning `node src/index.js` and verifies proper forwarding to `dist/index.js`.
  - **Compiled Binary**: Tests spawning `node dist/index.js` directly.
  - **Protocol Handshake**: Sends JSON-RPC `initialize` request and asserts:
    - Protocol version `2024-11-05`
    - Server info: `{ name: 'alexa-mcp-server', version: '1.2.0' }`
    - Declared capabilities: `{ tools: { listChanged: true } }`
  - **Tools Discovery**: Sends `tools/list` request and verifies all 19 tools are enumerated over the pipe.
  - **JSON-RPC Error Conformance**: Sends an invalid method (`nonexistent/method`) and verifies standard JSON-RPC error response `-32601` (Method not found).

### 3. HTTP & SSE Server Transport (`test/server-transport.test.ts`)
- **Transport**: Express HTTP server bound to an ephemeral port (`127.0.0.1:0`).
- **Coverage**:
  - **Root Overview**: Verifies `GET /` responds with HTTP 200 and an informational HTML page.
  - **CORS Handling**: Verifies `OPTIONS /mcp` returns HTTP 200 with `Access-Control-Allow-Origin: *`, allowed methods, and exposed `mcp-session-id` header.
  - **Streamable HTTP Endpoint (`POST /mcp`)**:
    - Tests stateful `initialize` POST request.
    - Asserts presence of `mcp-session-id` header in HTTP response.
    - Parses SSE formatted response (`event: message\ndata: {...}`) and verifies server info.
    - Sends subsequent `tools/list` POST request with `mcp-session-id` header and verifies tools list.
  - **Accept Header Normalization**: Verifies that requests without explicit `text/event-stream` or `application/json` are automatically normalized by Express middleware to prevent HTTP 406 (Not Acceptable) errors.
  - **Legacy SSE Endpoint (`GET /sse`)**: Verifies connection establishment and `Content-Type: text/event-stream` headers.
  - **Lifecycle Cleanup**: Verifies server closes all open connections immediately without hanging sockets.

### 4. Auth Storage & Security Invariants (`test/auth-storage.test.ts`)
- **Coverage**:
  - **Dynamic Path Resolution**: Verifies `ALEXA_MCP_AUTH_DIR` resolution, including tilde (`~`) home directory expansion.
  - **Atomic File Writing**: Verifies `_saveAuth()` writes credentials to a temporary file (`auth.json.<pid>.<seq>.tmp`), flushes to disk via `fsyncSync()`, and atomically renames to `auth.json`.
  - **POSIX File Permissions**:
    - Verifies `auth.json` is created with mode `0600` (read/write for owner only).
    - Verifies auth directory is created with mode `0700` (read/write/search for owner only).
    - Verifies pre-existing loose directory permissions (e.g. `0755`) are tightened to `0700`.
  - **macDms Registration Validation**: Verifies that attempting to initialize with credentials lacking device registration (`macDms`) immediately throws an actionable error instead of entering an infinite retry loop.

---

## Live Manual Verification

To perform end-to-end verification against real Alexa devices:

1. Ensure authentication is active:
   ```bash
   npm run auth
   ```
2. Run a smoke test to query devices:
   ```bash
   node --input-type=module -e "
   import { AlexaClient } from './dist/index.js';
   const client = new AlexaClient();
   await client.init();
   const devices = await client.getDevices();
   console.log(\`Found \${devices.length} devices. First: \${devices[0]?.accountName || devices[0]?.name}\`);
   "
   ```
3. Test stdio via Claude Desktop:
   - Configure `claude_desktop_config.json` with `dist/index.js`.
   - Restart Claude Desktop.
   - Ask: *"List my Alexa devices and check which ones are online."*
