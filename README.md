# alexa-mcp

> A robust, TypeScript-based [MCP (Model Context Protocol)](https://modelcontextprotocol.io) server that lets Claude, Perplexity, and any other MCP-compatible LLM control Amazon Alexa devices: speak announcements, execute text voice commands, manage smart-home groups, run routines, query sensor states, and more.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Node.js >= 18](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)
[![TypeScript: 5.x](https://img.shields.io/badge/TypeScript-5.x-blue)](https://www.typescriptlang.org/)
[![Tests: 29 Passing](https://img.shields.io/badge/tests-29%20passing-brightgreen)](./test)

Powered by a native TypeScript Alexa Remote engine (`src/alexa-remote/`) with complete compile-time type safety, automated tests, and dual-transport architecture (Stdio + Streamable HTTP / SSE).

---

## Architecture & Transports

`alexa-mcp` offers two flexible transport modes:

```
┌────────────────────────────────────────────────────────────────────────┐
│                              Clients                                   │
│  Claude Desktop │ Claude Code │ Antigravity IDE │ Perplexity │ Web UIs │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │
            ┌────────────────────────┴────────────────────────┐
            │                                                 │
   [1] Stdio Transport (Local)                     [2] HTTP / SSE Transport
      node dist/index.js (or src/index.js)            node dist/server.js
      • Standard input/output pipe                    • Streamable HTTP (POST /mcp)
      • Opens no network ports                        • Legacy SSE (GET /sse)
      • Ideal for desktop assistants                  • CORS-enabled for web/remote
            │                                                 │
            └────────────────────────┬────────────────────────┘
                                     ▼
                     ┌───────────────────────────────┐
                     │         AlexaClient           │
                     │  • Session token cache        │
                     │  • Atomic 0600/0700 storage   │
                     │  • Amazon Alexa REST & Push   │
                     └───────────────┬───────────────┘
                                     ▼
                     ┌───────────────────────────────┐
                     │       Amazon Alexa API        │
                     │  Echoes • Smart Home • Rooms  │
                     └───────────────────────────────┘
```

1. **Stdio Transport (`src/index.ts` / `dist/index.js` / `src/index.js`)**:
   Standard input/output communication for local LLM clients (Claude Desktop, Claude Code, Antigravity IDE). Opens no network ports.
2. **Streamable HTTP & SSE Server (`src/server.ts` / `dist/server.js`)**:
   High-performance Express server supporting the modern **MCP Streamable HTTP** specification (`POST /mcp` or `POST /`) as well as **Legacy SSE** (`GET /sse` with `POST /messages`). Includes CORS headers and session management, ideal for remote LLMs, Perplexity, Open WebUI, and Cloudflare Tunnels.

---

## Features (32 Tools)

Every tool is strictly typed with Zod schema validation and comprehensive error handling:

### 1. Echo Devices, Audio & Voice
| Tool Name | Description | Key Arguments |
|---|---|---|
| `alexa_list_devices` | List all Amazon Echo devices with serial numbers, model types, and online status | *None* |
| `alexa_set_volume` | Set device volume (0–100) | `serialNumber`, `volume` (0–100) |
| `alexa_get_volumes` | Read current volume levels across all Echo devices | *None* |
| `alexa_do_not_disturb` | Enable or disable Do Not Disturb mode | `serialNumber`, `enabled` (boolean) |
| `alexa_announce` | Push a spoken announcement with chime to an Echo | `serialNumber`, `message` |
| `alexa_text_command` | Send any voice command as text (*e.g.*, "turn on kitchen lights") | `serialNumber`, `command` |
| `alexa_speak` | Make Alexa speak plain text directly (no chime) | `serialNumber`, `text` |
| `alexa_speak_ssml` | Speak SSML markup with pauses, rate, pitch, and emphasis | `serialNumber`, `ssml` |

### 2. Direct Smart Home & Room Management
| Tool Name | Description | Key Arguments |
|---|---|---|
| `alexa_list_smarthome_devices` | List paired smart-home entities (lights, plugs, thermostats, locks) | *None* |
| `alexa_query_device` | Query real-time power, brightness, or sensor states | `entityIds` (string array) |
| `alexa_smarthome_action` | Direct smart home control: turn on/off, brightness, temperature, locks | `entityId`, `action`, `value`?, `entityType`? |
| `alexa_list_groups` | List configured smart-home groups/rooms and assigned appliances | *None* |
| `alexa_create_group` | Create a new room/group and assign appliance IDs | `name`, `applianceIds` |
| `alexa_update_group` | Update name and appliances in an existing room/group | `groupId`, `name`, `applianceIds` |
| `alexa_delete_group` | Remove a smart-home group/room | `groupId` |

### 3. Media Streaming & Audio Processing
| Tool Name | Description | Key Arguments |
|---|---|---|
| `alexa_play_music` | Stream music via Amazon Music, Spotify, Apple Music, TuneIn, Deezer | `serialNumber`, `searchPhrase`, `provider`? |
| `alexa_play_audible` | Play audiobooks from Audible on a target Echo | `serialNumber`, `searchPhrase` |
| `alexa_media_control` | Control playback: stop, pause, play, next, previous (supports "all") | `serialNumber`, `action` |
| `alexa_set_equalizer` | Adjust bass, midrange, and treble levels (-6 to +6 dB) | `serialNumber`, `bass`, `midrange`, `treble` |

### 4. Reminders, Alarms & Notifications
| Tool Name | Description | Key Arguments |
|---|---|---|
| `alexa_set_reminder` | Schedule spoken reminders with ISO 8601 timestamps or epoch ms | `serialNumber`, `text`, `timestamp` |
| `alexa_get_notifications` | List active alarms, timers, and reminders across all devices | `type`? ("all", "Alarm", "Timer", "Reminder") |
| `alexa_set_alarm_volume` | Adjust alarm and timer volume independently from music | `serialNumber`, `volume` (0–100) |

### 5. Routine Behaviors, Sounds & Fire TV
| Tool Name | Description | Key Arguments |
|---|---|---|
| `alexa_play_sound` | Play built-in sound effects (bells, doorbells, boings, applause, buzzers) | `serialNumber`, `soundId` |
| `alexa_curated_tts` | Speak curated phrases (good morning, compliments, birthday, etc.) | `serialNumber`, `category` |
| `alexa_play_behavior` | Trigger native routine behaviors (weather, traffic, flash briefing, jokes) | `serialNumber`, `behavior` |
| `alexa_fire_tv_control` | Remote control for Fire TV / Cube (power, pause, resume, home) | `serialNumber`, `command` |
| `alexa_list_routines` | List all routines, trigger phrases, and sequence actions | *None* |
| `alexa_execute_routine` | Trigger an existing automation routine | `routine` (routine object) |

### 6. Lists & Voice History
| Tool Name | Description | Key Arguments |
|---|---|---|
| `alexa_list_lists` | List shopping, to-do, and custom lists | *None* |
| `alexa_get_list_items` | Retrieve all items from a specified list | `listId` |
| `alexa_add_list_item` | Append a new item to a shopping or to-do list | `listId`, `value` |
| `alexa_get_history` | Retrieve recent voice interaction history, utterances, and devices | `limit`? (number, default: 10) |

---

## Requirements

- **Node.js ≥ 18.0.0**
- An Amazon account with at least one registered Alexa/Echo device
- An MCP-compatible client (Claude Desktop, Claude Code, Antigravity IDE, Perplexity, etc.)

---

## Installation & Setup

```bash
# Clone repository
git clone https://github.com/james----/alexa-mcp.git
cd alexa-mcp

# Install dependencies
npm install

# Build TypeScript
npm run build

# Run automated tests
npm test
```

---

## Authentication

Amazon's Alexa API is private and requires a browser-based login. The server includes an interactive authentication helper:

```bash
npm run auth
```

### What `npm run auth` does:
1. Starts a secure local HTTP proxy on `127.0.0.1:3457` (automatically opens your default browser on macOS).
2. You log in to your Amazon account securely. Handles 2FA / OTP seamlessly because it proxies Amazon's real authentication pages.
3. The proxy captures both the session cookies and the **device registration** (`macDms`) Amazon issues.
4. Credentials are automatically saved to `.auth-data/auth.json` with owner-only permissions (`0600`, directory `0700`).

You only need to run this once. The client refreshes the token automatically during normal operation.

### Why manual cookie pasting is unsupported:
The Alexa client gates initialization on `macDms` (device private key and ADP token) minted during browser registration. A raw session cookie lacks `macDms`, causing infinite initialization loops. The browser proxy is the only supported, reliable authentication mechanism.

### Multi-Account / Multi-Instance Setup
To serve multiple Alexa accounts from a single installation, point `ALEXA_MCP_AUTH_DIR` to a dedicated directory per instance:

```bash
# Authenticate personal account
ALEXA_MCP_AUTH_DIR=~/.alexa-mcp/personal npm run auth

# Authenticate work / second account
ALEXA_MCP_AUTH_DIR=~/.alexa-mcp/work npm run auth
```

Each instance maintains its own credentials in isolation.

---

## Client Configurations

### 1. Claude Desktop (Stdio)

Edit your Claude Desktop configuration:
- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "alexa": {
      "command": "node",
      "args": ["/absolute/path/to/alexa-mcp/dist/index.js"]
    }
  }
}
```

> **Backward Compatibility:** Existing client configurations pointing to `src/index.js` continue working seamlessly through the built-in forwarder shim.

### 2. Claude Code (CLI)

```bash
claude mcp add alexa -- node "$(pwd)/dist/index.js"
```

Verify connection:
```bash
claude mcp list
```

### 3. Streamable HTTP / SSE Server (Remote Clients & Web UIs)

Run the server:
```bash
# Production
npm run serve

# Development (hot reload)
npm run serve:dev
```

By default, the server listens on `0.0.0.0:8000` (configurable via `PORT` environment variable):
- **Streamable HTTP Endpoint (Recommended):** `http://localhost:8000/mcp` or `http://localhost:8000/`
- **Legacy SSE Endpoint:** `http://localhost:8000/sse` (messages at `POST /messages`)

Configure in remote MCP clients (*e.g.*, Perplexity, Open WebUI, LibreChat):
```json
{
  "mcpServers": {
    "alexa": {
      "url": "http://localhost:8000/mcp"
    }
  }
}
```

#### Running as a Background Service (macOS LaunchAgent)

To run `alexa-mcp` continuously in the background (auto-starts on login, survives reboots, and auto-recovers on crashes):

```bash
# Install and start the LaunchAgent background service
npm run service:install

# Check service status, active PID, network port, and recent logs
npm run service:status

# View live streaming logs
npm run service:logs

# Restart or reload the service
npm run service:restart

# Stop or start the service
npm run service:stop
npm run service:start

# Uninstall the LaunchAgent
npm run service:uninstall
```

##### Shell Shortcuts (`~/.zshrc` / `~/.bashrc`)

You can install convenient shell shortcuts into your `~/.zshrc` (or `~/.bashrc`) automatically:

```bash
# Install shortcuts into your active shell config (~/.zshrc or ~/.bashrc)
npm run service:shortcuts

# Remove shortcuts
npm run service:shortcuts:remove
```

Once installed and reloaded (`source ~/.zshrc`), you can use:
- `astatus` or `alexa status`
- `alogs` or `alexa logs`
- `arestart` or `alexa restart`
- `astop` or `alexa stop`
- `astart` or `alexa start`

The service runs via macOS `launchd` (`~/Library/LaunchAgents/com.vd0.alexa-mcp.plist`) and writes logs to `logs/server.launchd.log`.

---

## Environment Variables

| Variable | Default | Purpose |
|---|---|---|
| `ALEXA_MCP_AUTH_DIR` | `.auth-data/` | Path to store `auth.json` (supports `~/` expansion) |
| `ALEXA_AMAZON_PAGE` | `amazon.com` | Amazon marketplace host (*e.g.*, `amazon.co.uk`, `amazon.de`, `amazon.com.mx`) |
| `ALEXA_ACCEPT_LANGUAGE` | `en-US` | Preferred HTTP Accept-Language header (*e.g.*, `en-GB`, `de-DE`, `es-MX`) |
| `ALEXA_PROXY_LANGUAGE` | `en_US` | Proxy language parameter (*e.g.*, `en_GB`, `de_DE`, `es_MX`) |
| `ALEXA_PROXY_PORT` | `3457` | Local port used exclusively during `npm run auth` |
| `PORT` | `8000` | HTTP port used by `npm run serve` (Streamable HTTP / SSE) |

---

## Development & Scripts

| Command | Action |
|---|---|
| `npm run build` | Compiles TypeScript source to `dist/` with types and maps |
| `npm run watch` | Runs `tsc --watch` for incremental background compilation |
| `npm test` | Runs the full automated test suite (builds first) |
| `npm start` | Runs the compiled Stdio server (`node dist/index.js`) |
| `npm run dev` | Runs the Stdio server directly in TS via `tsx` |
| `npm run serve` | Starts the production HTTP/SSE server in foreground (`node dist/server.js`) |
| `npm run serve:dev` | Starts the HTTP/SSE server in TS via `tsx` |
| `npm run service:install` | Installs and starts the LaunchAgent background service |
| `npm run service:status` | Shows status, PID, port listener, and recent logs |
| `npm run service:logs` | Streams live logs from the background service |
| `npm run service:restart` | Restarts the background service |
| `npm run service:stop` | Stops the background service |
| `npm run service:start` | Starts the background service |
| `npm run service:shortcuts` | Automatically installs shell shortcuts into `~/.zshrc` / `~/.bashrc` |
| `npm run service:shortcuts:remove` | Removes shell shortcuts from `~/.zshrc` / `~/.bashrc` |
| `npm run service:uninstall` | Unloads and removes the background service |
| `npm run auth` | Starts the interactive browser proxy auth flow |

---

## Testing & Quality Assurance

`alexa-mcp` ships with a comprehensive test suite built on Node's native test runner (`node:test`) and `@modelcontextprotocol/sdk/inMemory.js`:

```bash
npm test
```

### Test Coverage (24 Tests across 4 Suites):
1. **`test/tools.test.ts`**:
   - In-memory MCP client/server integration.
   - Verifies registration, schemas, and descriptions for all 32 tools.
   - Tests mock execution of every smart home, media, audio, reminder, routine, Fire TV, and history tool.
   - Verifies Zod input validation (e.g. volume out-of-bounds rejection).
   - Tests error handling when the upstream Alexa API fails.
2. **`test/stdio-transport.test.ts`**:
   - Spawns subprocesses over actual stdin/stdout pipes.
   - Tests MCP `initialize` and `tools/list` handshakes on `src/index.js` (backward-compat shim).
   - Tests MCP handshakes on `dist/index.js` (compiled binary).
   - Verifies JSON-RPC error codes on unrecognized methods (`-32601`).
3. **`test/server-transport.test.ts`**:
   - Express server lifecycle and ephemeral port binding.
   - Tests CORS headers (`Access-Control-Allow-Origin: *`, `mcp-session-id`).
   - Tests Streamable HTTP `POST /mcp` stateful sessions.
   - Tests SSE `GET /sse` streams.
   - Tests automatic `Accept` header normalization (`application/json, text/event-stream`).
4. **`test/auth-storage.test.ts`**:
   - Atomic file write verification (temp file -> sync -> atomic rename).
   - File permission verification (`0600` for `auth.json`, `0700` for directory).
   - Automatic tightening of insecure directory permissions.
   - Rejection of corrupt or missing device registrations (`macDms`).

See [docs/TESTING.md](./docs/TESTING.md) for deep-dive testing documentation.

---

## Security Model

- **Atomic File Writing**: Credentials in `.auth-data/auth.json` are written to a unique temporary file opened with `O_CREAT | O_EXCL` at mode `0600`, flushed to disk via `fsync`, and atomically replaced via `rename`. No partial files, race conditions, or unencrypted leaks.
- **Directory Hardening**: Auth directories are verified at mode `0700` and tightened immediately if found looser.
- **Local Proxy Binding**: `npm run auth` binds strictly to `127.0.0.1`, never exposing authentication cookies to external network interfaces.
- **Git Safety**: `.auth-data/`, cookies, and tokens are permanently ignored in `.gitignore`.
- **Dependency Pinning**: Enforces `alexa-cookie2 >= 5.0.4` to avoid Amazon `400 InvalidToken` refresh regressions.

---

## Project Structure

```
alexa-mcp/
├── src/
│   ├── index.ts              # MCP Stdio server entrypoint & factory
│   ├── index.js              # Backward-compatibility shim (forwards to dist/)
│   ├── alexa-client.ts       # Typed wrapper around the Alexa remote client with atomic auth
│   ├── alexa-remote/         # Native TypeScript Alexa Remote engine & HTTP/2 push listener
│   ├── tools.ts              # 32 MCP tool registrations with Zod schemas
│   ├── server.ts             # Streamable HTTP & SSE Express server
│   ├── auth.ts               # Interactive proxy login flow
│   └── types/
│       └── alexa.ts          # Domain interfaces (AuthData, Devices, Groups, etc.)
├── dist/                     # Compiled JavaScript, TypeScript declarations & maps
├── test/
│   ├── alexa-remote.test.ts  # Native Alexa Remote engine unit tests
│   ├── tools.test.ts         # In-memory tests for all 32 tools & schemas
│   ├── stdio-transport.test.ts # Subprocess stdio JSON-RPC handshake tests
│   ├── server-transport.test.ts # Express Streamable HTTP & SSE transport tests
│   └── auth-storage.test.ts  # File mode (0600/0700) & atomic write security tests
├── docs/
│   ├── ARCHITECTURE.md       # Architectural deep dive & protocol mechanics
│   └── TESTING.md            # Comprehensive test strategy & execution guide
├── .auth-data/               # Git-ignored local credentials store (mode 0700)
│   └── auth.json             # Session cookies & device registration (mode 0600)
├── CHANGELOG.md              # Detailed release and migration history
├── package.json              # Package manifest & build scripts
├── tsconfig.json             # TypeScript compiler configuration (ES2022/NodeNext)
├── LICENSE                   # MIT License
└── README.md                 # Project documentation
```

---

## Acknowledgments

- The **Model Context Protocol** team at Anthropic.

---

## License

[MIT](./LICENSE) © James Tucker
