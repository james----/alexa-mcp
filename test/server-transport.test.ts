import test, { describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import { app } from '../src/server.js';

describe('HTTP & SSE Server Transport', () => {
  let server: Server;
  let baseUrl: string;

  before(async () => {
    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        if (typeof addr === 'object' && addr !== null) {
          baseUrl = `http://127.0.0.1:${addr.port}`;
        }
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise<void>((resolve, reject) => {
      server.closeAllConnections?.();
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  test('GET / returns informational HTML', async () => {
    const res = await fetch(`${baseUrl}/`);
    assert.equal(res.status, 200);
    const text = await res.text();
    assert.match(text, /alexa-mcp server is running/);
    assert.match(text, /POST \/mcp/);
    assert.match(text, /GET \/sse/);
  });

  test('OPTIONS /mcp returns CORS headers', async () => {
    const res = await fetch(`${baseUrl}/mcp`, {
      method: 'OPTIONS',
    });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('access-control-allow-origin'), '*');
    assert.match(res.headers.get('access-control-allow-methods') || '', /POST/);
    assert.equal(res.headers.get('access-control-expose-headers'), 'mcp-session-id');
  });

  test('GET /mcp returns instructions for JSON-RPC POST', async () => {
    const res = await fetch(`${baseUrl}/mcp`);
    assert.equal(res.status, 200);
    const text = await res.text();
    assert.match(text, /alexa-mcp Streamable HTTP endpoint is active/);
  });

  function parseMcpSseResponse(text: string) {
    const line = text.split('\n').find((l) => l.startsWith('data: '));
    if (!line) throw new Error('No data line found in SSE response: ' + text);
    return JSON.parse(line.slice(6));
  }

  test('POST /mcp handles stateful initialize and tools/list session flow', async () => {
    // 1. Initialize
    const initPayload = {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'web-client', version: '1.0.0' },
      },
    };

    const initRes = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(initPayload),
    });

    assert.equal(initRes.status, 200);
    const sessionId = initRes.headers.get('mcp-session-id');
    assert.ok(sessionId, 'Should return mcp-session-id header');

    const initText = await initRes.text();
    const initData = parseMcpSseResponse(initText);
    assert.equal(initData.result.serverInfo.name, 'alexa-mcp-server');
    assert.equal(initData.result.serverInfo.version, '1.2.0');

    // 2. tools/list with session
    const listPayload = {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
      params: {},
    };

    const listRes = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'mcp-session-id': sessionId,
      },
      body: JSON.stringify(listPayload),
    });

    assert.equal(listRes.status, 200);
    const listText = await listRes.text();
    const listData = parseMcpSseResponse(listText);
    assert.ok(listData.result.tools);
    assert.equal(listData.result.tools.length, 32);
  });

  test('GET /sse establishes Server-Sent Events stream', async () => {
    const controller = new AbortController();
    try {
      const res = await fetch(`${baseUrl}/sse`, {
        headers: { Accept: 'text/event-stream' },
        signal: controller.signal,
      });

      assert.equal(res.status, 200);
      assert.match(res.headers.get('content-type') || '', /text\/event-stream/);
    } catch (err: any) {
      if (err.name !== 'AbortError') throw err;
    } finally {
      controller.abort();
    }
  });
});
