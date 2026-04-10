const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');

/**
 * MCP Service: Powers the AI Agent extensions.
 * Allows the Mentor to use external tools like local filesystem, DB explorers, etc.
 */
class MCPService {
    constructor() {
        this.clients = new Map(); // serverName -> client
    }

    async connectToServer(name, command, args = []) {
        try {
            console.log(`[MCP] Connecting to server: ${name}...`);
            const transport = new StdioClientTransport({ command, args });
            const client = new Client({
                name: "AMIT-BODHIT-Core",
                version: "1.0.0"
            }, {
                capabilities: {
                    tools: {}
                }
            });

            await client.connect(transport);
            this.clients.set(name, client);
            console.log(`[MCP] Server ${name} connected.`);
            return true;
        } catch (e) {
            console.error(`[MCP Error] Connection failed for ${name}:`, e.message);
            return false;
        }
    }

    async listTools() {
        const allTools = [];
        for (const [name, client] of this.clients) {
            const result = await client.listTools();
            allTools.push(...(result.tools || []).map(t => ({ ...t, server: name })));
        }
        return allTools;
    }

    async callTool(serverName, toolName, args) {
        const client = this.clients.get(serverName);
        if (!client) throw new Error(`MCP Server ${serverName} not connected`);
        
        console.log(`[MCP] Calling tool: ${toolName} on ${serverName}...`);
        return await client.callTool({
            name: toolName,
            arguments: args
        });
    }

    async disconnectAll() {
        for (const [name, client] of this.clients) {
            // Close logic if available in SDK
        }
        this.clients.clear();
    }
}

module.exports = new MCPService();
