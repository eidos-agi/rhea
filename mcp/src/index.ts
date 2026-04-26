#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { 
  loadClientConfig, 
  getOrderedServers, 
  rpc, 
  routeChatCompletion 
} from "@rhea/lib";
import providers from "../../providers.json" with { type: "json" };

const server = new Server(
  {
    name: "rhea-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

/**
 * Executes a Rhea prompt through the fallback chain
 */
async function executeRheaPrompt(model: string, prompt: string) {
  const config = loadClientConfig();
  const orderedServers = getOrderedServers(config);
  
  for (const srv of orderedServers) {
    try {
      const res = await rpc(srv, 'ask', { model, messages: [{ role: 'user', content: prompt }] });
      return res.choices[0].message.content;
    } catch (e) {
      // Fallback to next
    }
  }

  // Final local fallback
  const res = await routeChatCompletion(model, [{ role: 'user', content: prompt }]);
  return res.choices[0].message.content;
}

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "ask_rhea",
        description: "Ask a question to Rhea's orchestrated AI models (Claude, Gemini, etc.)",
        inputSchema: {
          type: "object",
          properties: {
            prompt: { type: "string", description: "The prompt to send to the model" },
            model: { 
              type: "string", 
              description: "Optional logical model name (e.g., claude-pro, gemini-advanced)",
              default: "claude-pro"
            },
          },
          required: ["prompt"],
        },
      },
      {
        name: "list_rhea_servers",
        description: "List configured Rhea remote servers and their status",
        inputSchema: { type: "object", properties: {} },
      }
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  switch (request.params.name) {
    case "ask_rhea": {
      const prompt = String(request.params.arguments?.prompt);
      const model = String(request.params.arguments?.model || "claude-pro");
      
      try {
        const response = await executeRheaPrompt(model, prompt);
        return {
          content: [{ type: "text", text: response }],
        };
      } catch (err: any) {
        return {
          content: [{ type: "text", text: `Error executing Rhea prompt: ${err.message}` }],
          isError: true,
        };
      }
    }

    case "list_rhea_servers": {
      const config = loadClientConfig();
      const servers = Object.entries(config.servers).map(([name, srv]) => {
        return `${name === config.activeServer ? "*" : " "} ${name} (${srv.host})`;
      }).join("\n");
      
      return {
        content: [{ type: "text", text: servers || "No remote servers configured." }],
      };
    }

    default:
      throw new Error("Unknown tool");
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
