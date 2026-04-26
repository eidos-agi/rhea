#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { 
  loadClientConfig, 
  saveClientConfig,
  getOrderedServers, 
  rpc, 
  routeChatCompletion,
  Pod
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

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "rhea_debate",
        description: "Run a three-model Socratic debate (Dreamer/Doubter/Decider) to orchestrate high-quality intelligence.",
        inputSchema: {
          type: "object",
          properties: {
            question: { type: "string", description: "The central question or task to debate" },
            context: { type: "string", description: "Optional background context" },
            max_rounds: { type: "number", description: "Max rounds of debate before forcing a decision", default: 3 },
            models: { 
              type: "array", 
              items: { type: "string" }, 
              description: "List of 3 models to use (e.g., ['claude-pro', 'gemini-advanced', 'openrouter:auto'])",
              default: ["claude-pro", "gemini-advanced", "openrouter:auto"]
            },
          },
          required: ["question"],
        },
      },
      {
        name: "rhea_quick",
        description: "A single-round quick sanity check using the Rhea Pod architecture.",
        inputSchema: {
          type: "object",
          properties: {
            question: { type: "string", description: "The question to check" },
          },
          required: ["question"],
        },
      },
      {
        name: "rhea_status",
        description: "Check the status of configured Rhea servers and local providers.",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "rhea_pair",
        description: "Pair this Rhea instance with a remote server using a short code.",
        inputSchema: {
          type: "object",
          properties: {
            label: { type: "string", description: "A friendly name for the server" },
            host: { type: "string", description: "The SSH host (e.g., user@mac-laptop)" },
            code: { type: "string", description: "The 6-character pairing code from the server" },
          },
          required: ["label", "host", "code"],
        },
      }
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const config = loadClientConfig();

  switch (request.params.name) {
    case "rhea_debate": {
      const { question, context, max_rounds, models } = request.params.arguments as any;
      const pod = new Pod(models || ["claude-pro", "gemini-advanced", "openrouter:auto"], config);
      try {
        const result = await pod.debate(question, { context, maxRounds: max_rounds });
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (err: any) {
        return {
          content: [{ type: "text", text: `Debate failed: ${err.message}` }],
          isError: true,
        };
      }
    }

    case "rhea_quick": {
      const { question } = request.params.arguments as any;
      const pod = new Pod(["claude-pro", "gemini-advanced", "openrouter:auto"], config);
      try {
        const result = await pod.debate(question, { maxRounds: 1 });
        return {
          content: [{ type: "text", text: result.decision || "No decision reached." }],
        };
      } catch (err: any) {
        return {
          content: [{ type: "text", text: `Quick check failed: ${err.message}` }],
          isError: true,
        };
      }
    }

    case "rhea_status": {
      const servers = Object.entries(config.servers).map(([name, srv]) => {
        return `${name === config.activeServer ? "*" : " "} ${name} (${srv.host})`;
      }).join("\n");
      const localModels = Object.keys(providers).join(", ");
      
      const statusText = `Remote Servers:\n${servers || "None"}\n\nLocal Models: ${localModels}`;
      return {
        content: [{ type: "text", text: statusText }],
      };
    }

    case "rhea_pair": {
      const { label, host, code } = request.params.arguments as any;
      try {
        const tempServer = { host, token: "" };
        const generator = rpc(tempServer, 'exchange-code', { code });
        let result;
        for await (const chunk of generator) { result = chunk; }
        
        config.servers[label] = { host, token: result.token };
        if (!config.activeServer) config.activeServer = label;
        saveClientConfig(config);
        
        return {
          content: [{ type: "text", text: `✅ Successfully paired with ${label} (${host})` }],
        };
      } catch (err: any) {
        return {
          content: [{ type: "text", text: `Pairing failed: ${err.message}` }],
          isError: true,
        };
      }
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
