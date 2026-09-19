import express, { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { AlexaClient } from './alexa-client.js';
import { createAlexaServer } from './index.js';

const app = express();
const PORT = process.env.PORT || 8000;
const client = new AlexaClient();

// Allow all origins/hosts so Cloudflare Tunnel, Perplexity, Claude, etc. can connect
app.use((req: Request, res: Response, next: NextFunction) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', '*');
  res.header('Access-Control-Expose-Headers', 'mcp-session-id');

  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }

  // Ensure Accept header supports both application/json and text/event-stream per MCP specification
  let accept = (req.headers['accept'] as string) || '';
  if (!accept.includes('application/json')) {
    accept = accept ? `${accept}, application/json` : 'application/json';
  }
  if (!accept.includes('text/event-stream')) {
    accept = `${accept}, text/event-stream`;
  }
  req.headers['accept'] = accept;

  if (req.rawHeaders) {
    const acceptIdx = req.rawHeaders.findIndex((h) => h.toLowerCase() === 'accept');
    if (acceptIdx !== -1) {
      req.rawHeaders[acceptIdx + 1] = accept;
    } else {
      req.rawHeaders.push('Accept', accept);
    }
  }

  next();
});

app.use(express.json());

// =============================================================================
// 1. MCP Streamable HTTP Transport (/mcp and POST /)
// =============================================================================
const streamableTransports = new Map<string, StreamableHTTPServerTransport>();

function isInitializeRequest(body: any): boolean {
  return Boolean(body && typeof body === 'object' && body.method === 'initialize');
}

async function handleStreamableHttp(req: Request, res: Response): Promise<void> {
  const sessionId = (req.headers['mcp-session-id'] as string) || (req.query.sessionId as string);
  let transport: StreamableHTTPServerTransport | undefined;

  console.log(
    `[${new Date().toLocaleTimeString()}] [StreamableHTTP] ${req.method} ${req.path} (Session: ${
      sessionId || 'none'
    })`
  );

  try {
    if (sessionId && streamableTransports.has(sessionId)) {
      transport = streamableTransports.get(sessionId)!;
    } else if (req.method === 'POST') {
      if (isInitializeRequest(req.body)) {
        // Stateful initialization
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (sid: string) => {
            console.log(
              `[${new Date().toLocaleTimeString()}] [StreamableHTTP] Session initialized: ${sid}`
            );
            if (transport) streamableTransports.set(sid, transport);
          },
        });

        transport.onclose = () => {
          const sid = transport?.sessionId;
          if (sid) {
            console.log(
              `[${new Date().toLocaleTimeString()}] [StreamableHTTP] Session closed: ${sid}`
            );
            streamableTransports.delete(sid);
          }
        };

        const server = createAlexaServer(client);
        await server.connect(transport);
      } else {
        // Stateless invocation (direct tool calls without prior session handshake)
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: undefined,
        });
        const server = createAlexaServer(client);
        await server.connect(transport);
      }
    } else if (req.method === 'GET') {
      res
        .status(200)
        .send(
          'alexa-mcp Streamable HTTP endpoint is active. Send POST requests with JSON-RPC payload to /mcp.'
        );
      return;
    } else {
      res.status(400).json({
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: 'Bad request: Expected POST with initialization or valid session ID',
        },
        id: null,
      });
      return;
    }

    await transport.handleRequest(req, res, req.body);
  } catch (err: any) {
    console.error('[StreamableHTTP] Error handling request:', err);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: 'Internal server error: ' + (err.message || String(err)),
        },
        id: null,
      });
    }
  }
}

app.all('/mcp', handleStreamableHttp);

// =============================================================================
// 2. Legacy SSE Transport (/sse and /messages)
// =============================================================================
const sseTransports = new Map<string, SSEServerTransport>();

app.get('/sse', async (req: Request, res: Response) => {
  console.log(`[${new Date().toLocaleTimeString()}] [SSE] Incoming connection from ${req.ip}`);
  try {
    const transport = new SSEServerTransport('/messages', res);
    const sessionId = transport.sessionId;
    sseTransports.set(sessionId, transport);

    transport.onclose = () => {
      console.log(`[${new Date().toLocaleTimeString()}] [SSE] Session closed: ${sessionId}`);
      sseTransports.delete(sessionId);
    };

    const server = createAlexaServer(client);
    await server.connect(transport);
    console.log(`[${new Date().toLocaleTimeString()}] [SSE] Session established: ${sessionId}`);
  } catch (err) {
    console.error('[SSE] Error establishing connection:', err);
    if (!res.headersSent) {
      res.status(500).send('Error establishing SSE stream');
    }
  }
});

async function handleMessagePost(req: Request, res: Response): Promise<void> {
  const sessionId = req.query.sessionId as string;
  if (!sessionId) {
    console.error('[POST] Missing sessionId in query parameters');
    res.status(400).send('Missing sessionId parameter');
    return;
  }

  const transport = sseTransports.get(sessionId);
  if (!transport) {
    console.error(`[POST] No active transport for session: ${sessionId}`);
    res.status(404).send('Session not found');
    return;
  }

  try {
    await transport.handlePostMessage(req, res, req.body);
  } catch (err) {
    console.error(`[POST] Error handling message for session ${sessionId}:`, err);
    if (!res.headersSent) {
      res.status(500).send('Error handling message');
    }
  }
}

app.post('/messages', handleMessagePost);
app.post('/message', handleMessagePost);

// Root route
app.post('/', handleStreamableHttp);
app.get('/', (_req: Request, res: Response) => {
  res.send(`
    <h2>alexa-mcp server is running!</h2>
    <ul>
      <li><b>Streamable HTTP (Recommended):</b> <code>POST /mcp</code> or <code>POST /</code></li>
      <li><b>Legacy SSE:</b> <code>GET /sse</code> with <code>POST /messages</code></li>
    </ul>
  `);
});

export { app };

const isMain = process.argv[1] && (
  fileURLToPath(import.meta.url) === process.argv[1] ||
  process.argv[1].endsWith('/dist/server.js') ||
  process.argv[1].endsWith('/src/server.ts')
);

if (isMain) {
  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`alexa-mcp server listening on port ${PORT}`);
    console.log(`Streamable HTTP endpoint: http://localhost:${PORT}/mcp`);
    console.log(`Legacy SSE endpoint:      http://localhost:${PORT}/sse`);
  });
}
