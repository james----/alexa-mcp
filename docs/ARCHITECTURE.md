# Architecture & Technical Design

This document details the architectural design, transport protocols, concurrency model, and security implementation of `alexa-mcp`.

---

## High-Level Overview

`alexa-mcp` is an MCP (Model Context Protocol) server designed to interface large language models (LLMs) with Amazon Echo and smart home devices. It acts as a bridge between the standardized MCP JSON-RPC protocol and Amazon's private Alexa REST & Push endpoints via the native TypeScript `alexa-remote` engine.

```
                    ┌───────────────────────────┐
                    │      MCP Client (LLM)     │
                    │ Claude / Perplexity / IDE │
                    └─────────────┬─────────────┘
                                  │ JSON-RPC 2.0
                                  ▼
      ┌───────────────────────────────────────────────────────┐
      │                   Transport Layer                     │
      │                                                       │
      │   ┌───────────────────────┐   ┌───────────────────┐   │
      │   │ StdioServerTransport  │   │  Express Server   │   │
      │   │   (CLI / Desktop)     │   │ (HTTP/SSE Remote) │   │
      │   └───────────┬───────────┘   └─────────┬─────────┘   │
      └───────────────┼─────────────────────────┼─────────────┘
                      │                         │
                      ▼                         ▼
      ┌───────────────────────────────────────────────────────┐
      │                  MCP Server Layer                     │
      │               createAlexaServer()                     │
      │  • 32 Registered Tools (Zod validation)               │
      │  • JSON-RPC serialization & error encapsulation       │
      └───────────────────────────┬───────────────────────────┘
                                  │
                                  ▼
      ┌───────────────────────────────────────────────────────┐
      │                  AlexaClient Layer                    │
      │  • init() concurrency memoization (_initPromise)      │
      │  • Atomic 0600/0700 credential persistence            │
      │  • Automatic token renewal & cookie refresh           │
      │  • Native alexa-remote engine & type-safe facades     │
      └───────────────────────────┬───────────────────────────┘
                                  │
                                  ▼
      ┌───────────────────────────────────────────────────────┐
      │                  Amazon Alexa Cloud                   │
      │  Echo Devices • Smart Home Skill API • Routines       │
      └───────────────────────────────────────────────────────┘
```

---

## Transport Layer

`alexa-mcp` supports two transport topologies:

### 1. Stdio Transport (`src/index.ts` -> `dist/index.js`)
- **Protocol**: Standard I/O streams (`process.stdin` / `process.stdout`) using `@modelcontextprotocol/sdk/server/stdio.js`.
- **Use Case**: Local applications like Claude Desktop, Claude Code, Antigravity IDE, Cursor, and command-line interfaces.
- **Security**: Completely isolated. Opens no TCP/UDP network ports; accessible only to the parent process spawning the binary.
- **Backward Compatibility**: A compatibility shim at `src/index.js` imports `../dist/index.js` and invokes `startStdioServer()`, ensuring existing client configs configured with `/path/to/src/index.js` continue working without modification.

### 2. Streamable HTTP & SSE Transport (`src/server.ts` -> `dist/server.js`)
- **Protocol**: Express application supporting both the modern **Streamable HTTP** spec (`POST /mcp`) and **Legacy SSE** (`GET /sse`).
- **Use Case**: Remote LLM connections, Cloudflare Tunnels, Perplexity, Open WebUI, and web clients.
- **Features**:
  - **CORS Handling**: Permissive CORS (`Access-Control-Allow-Origin: *`, `mcp-session-id` exposure) allows browser web clients and reverse proxies to connect without obstruction.
  - **Header Normalization**: Automatically normalizes incoming `Accept` headers to include both `application/json` and `text/event-stream`, preventing HTTP 406 (Not Acceptable) errors across disparate clients.
  - **Stateful Sessions**: Generates unique `mcp-session-id` UUIDs during `initialize` requests and maintains active transport mappings in memory.
  - **Stateless Fallback**: Supports direct, uninitialized tool invocations when clients execute requests without prior session handshake.

---

## Core Abstractions

### `AlexaClient` (`src/alexa-client.ts`)
The central controller managing interaction with Amazon:
- **Initialization Memoization**:
  When concurrent tool calls arrive simultaneously, calling `init()` multiple times could trigger duplicate connection handshakes. `AlexaClient` memoizes the active `_initPromise`, ensuring multiple concurrent calls await the exact same initialization promise.
- **Session Refresh**:
  Amazon sessions expire after 24 hours. The client intercepts token expiration and renews sessions using the stored `macDms` registration token.
- **Domain Facades**:
  Provides strongly-typed Promise-based wrappers for all device queries, volume adjustments, announcement broadcasts, text-to-speech commands, routines, and smart home group modifications.

### Type System (`src/types/alexa.ts`)
Domain models are isolated in a dedicated type module:
- `AuthData`: Structured credentials containing cookie, device registration (`macDms`), and marketplace metadata.
- `RegistrationData`: Contains `macDms` device private keys, ADP tokens, and version tracking.
- `AlexaDevice`: Strongly-typed representation of Amazon Echo hardware, capabilities, and online state.
- `SmarthomeEntity`: Smart home appliances, device types, and endpoints.
- `SmarthomeGroup`: Rooms and appliance association mappings.
- `VolumeMap`: Device-name-to-integer volume mapping.

---

## Security Architecture

1. **Atomic Credential Writes (`_saveAuth`)**:
   - Credentials contain session cookies and Amazon device private keys.
   - To prevent corrupted writes during power loss or abrupt termination, files are written to a temporary path (`auth.json.<pid>.<seq>.tmp`) opened with flags `O_CREAT | O_EXCL` and mode `0600`.
   - Data is flushed to physical storage using `fsyncSync()` before executing an atomic OS `renameSync()` over `auth.json`.
   - If an error occurs, the temporary file is unlinked immediately.
2. **Directory Hardening**:
   - The credential directory is initialized at mode `0700` (`rwx------`).
   - If a pre-existing directory is found with looser permissions (*e.g.*, `0755`), `ensureSecureAuthDir()` automatically tightens permissions to `0700`.
3. **Registration Integrity (`macDms` Enforcement)**:
   - The client requires valid device registration data (`macDms`). Hand-edited files or manual cookie pastes lack `macDms` and cause infinite loops.
   - `AlexaClient._doInit()` performs strict sanity checks on `reg.macDms.adp_token` and `device_private_key`, throwing an actionable error if invalid.
4. **Localhost-Only Auth Proxy**:
   - During `npm run auth`, the login proxy binds strictly to `127.0.0.1`. It never listens on public or routable network interfaces.

---

## Build & Runtime Flow

```
src/ (TypeScript ES2022)
  ├── index.ts
  ├── alexa-client.ts
  ├── alexa-remote/
  ├── tools.ts
  ├── server.ts
  ├── auth.ts
  └── types/alexa.ts
         │
         │ npm run build (tsc)
         ▼
dist/ (Compiled Output)
  ├── *.js        (ES Modules)
  ├── *.d.ts     (TypeScript Type Declarations)
  └── *.js.map   (Source Maps for Debugging)
```

- **Runtime Execution**: Production environments run `node dist/index.js` or `node dist/server.js` with zero runtime TypeScript overhead.
- **Development Execution**: Developers run `tsx src/index.ts` or `tsx src/server.ts` for instant feedback with hot reload without separate compile steps.
