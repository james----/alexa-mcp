# Changelog - alexa-mcp

Chronological log of notable changes in this project.

## Conventions

- Messages in English, concise format
- Notable events only (non-routine)
- Reverse chronological order: most recent on top
- When closing major work: update entry and commit

## 1.2.0 — Initial Release

- **Native TypeScript Alexa Core (`src/alexa-remote/`)**: Modernized ESM TypeScript implementation interfacing directly with Amazon's Alexa API, with HTTP/2 push notification listener, dynamic locale resolution, and strict type safety.
- **Dual MCP Transports**: Supports both Stdio transport (`src/index.ts` / `dist/index.js`) for local LLM desktop clients (Claude Desktop, Antigravity IDE) and Streamable HTTP / Legacy SSE server (`src/server.ts` / `dist/server.js`) on port 8000.
- **32 MCP Tools**: Comprehensive tool suite covering Echo device queries, volume adjustments, smart-home appliance control, room groups, music streaming, audiobooks, equalizer, alarms, reminders, notifications, routine behaviors, Fire TV remote control, and voice history.
- **macOS LaunchAgent Service**: Built-in background daemon manager (`scripts/service.sh`) and shell shortcuts (`astatus`, `arestart`, `alogs`, etc.).
- **Security & Storage**: Atomic 0600 file writes with sync flushing and 0700 credential directory enforcement.
- **Comprehensive Test Suite**: Automated 29-test suite across 5 test suites validating auth storage, transports, tools, and remote client invariants.
