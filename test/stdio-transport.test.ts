import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';

interface JsonRpcMessage {
  jsonrpc: string;
  id?: number | string;
  method?: string;
  params?: any;
  result?: any;
  error?: any;
}

class SubprocessRpcClient {
  private child: ChildProcess;
  private buffer: string = '';
  private nextId = 1;
  private pending = new Map<number, (res: JsonRpcMessage) => void>();

  constructor(scriptPath: string) {
    this.child = spawn('node', [scriptPath], {
      stdio: ['pipe', 'pipe', 'inherit'],
    });

    this.child.stdout?.on('data', (chunk: Buffer) => {
      this.buffer += chunk.toString();
      const lines = this.buffer.split('\n');
      this.buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const msg = JSON.parse(line) as JsonRpcMessage;
          if (typeof msg.id === 'number' && this.pending.has(msg.id)) {
            const resolve = this.pending.get(msg.id)!;
            this.pending.delete(msg.id);
            resolve(msg);
          }
        } catch (e) {
          // ignore non-JSON logging
        }
      }
    });
  }

  async send(method: string, params: any = {}): Promise<JsonRpcMessage> {
    const id = this.nextId++;
    const payload = JSON.stringify({
      jsonrpc: '2.0',
      id,
      method,
      params,
    }) + '\n';

    return new Promise<JsonRpcMessage>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Timeout waiting for response to ${method} (id=${id})`));
      }, 5000);

      this.pending.set(id, (res) => {
        clearTimeout(timeout);
        resolve(res);
      });

      this.child.stdin?.write(payload);
    });
  }

  close() {
    this.child.kill();
  }
}

describe('Stdio Server Transport', () => {
  test('src/index.js (shim) supports initialize and tools/list handshakes', async () => {
    const client = new SubprocessRpcClient('src/index.js');
    try {
      const initRes = await client.send('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'test-runner', version: '1.0.0' },
      });

      assert.ok(initRes.result, 'Response must have a result');
      assert.equal(initRes.result.serverInfo.name, 'alexa-mcp-server');
      assert.equal(initRes.result.serverInfo.version, '1.2.0');
      assert.ok(initRes.result.capabilities.tools, 'Server must declare tools capability');

      const toolsRes = await client.send('tools/list', {});
      assert.ok(toolsRes.result, 'Response must have tools list');
      assert.equal(toolsRes.result.tools.length, 32);
    } finally {
      client.close();
    }
  });

  test('dist/index.js (compiled) supports initialize and tools/list handshakes', async () => {
    const client = new SubprocessRpcClient('dist/index.js');
    try {
      const initRes = await client.send('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'test-runner', version: '1.0.0' },
      });

      assert.ok(initRes.result);
      assert.equal(initRes.result.serverInfo.name, 'alexa-mcp-server');
      assert.equal(initRes.result.serverInfo.version, '1.2.0');

      const toolsRes = await client.send('tools/list', {});
      assert.ok(toolsRes.result);
      assert.equal(toolsRes.result.tools.length, 32);
    } finally {
      client.close();
    }
  });

  test('returns standard JSON-RPC error on unrecognized method', async () => {
    const client = new SubprocessRpcClient('dist/index.js');
    try {
      await client.send('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'test-runner', version: '1.0.0' },
      });

      const errRes = await client.send('nonexistent/method', {});
      assert.ok(errRes.error, 'Should return error object');
      assert.equal(errRes.error.code, -32601, 'Method not found error code');
    } finally {
      client.close();
    }
  });
});
