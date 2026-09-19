import { fileURLToPath } from 'node:url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { AlexaClient } from './alexa-client.js';
import { registerTools } from './tools.js';
export function createAlexaServer(client = new AlexaClient()) {
    const server = new McpServer({
        name: 'alexa-mcp-server',
        version: '1.2.0',
    });
    registerTools(server, client);
    return server;
}
export async function startStdioServer() {
    const client = new AlexaClient();
    const server = createAlexaServer(client);
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
export { AlexaClient } from './alexa-client.js';
export { registerTools } from './tools.js';
// Start stdio server when executed directly (CLI / Claude Desktop / tsx)
const isMain = process.argv[1] && (fileURLToPath(import.meta.url) === process.argv[1] ||
    process.argv[1].endsWith('/dist/index.js') ||
    process.argv[1].endsWith('/src/index.ts'));
if (isMain) {
    await startStdioServer();
}
//# sourceMappingURL=index.js.map