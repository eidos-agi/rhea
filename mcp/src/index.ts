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
  Pod,
  loadSession,
  saveSession,
  generateSessionId
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
 * Executes a Rhea prompt through the fallback chain with session support
 */
async function executeRheaPrompt(model: string, prompt: string, sessionId?: string) {
  const config = loadClientConfig();
  const history = sessionId ? loadSession(sessionId) : [];
  const messages = [...history, { role: 'user', content: prompt }];
  
  const orderedServers = getOrderedServers(config);
  let finalContent = "";
  let success = false;

  for (const srv of orderedServers) {
    try {
      const generator = rpc(srv, 'ask', { model, messages, stream: false, sessionId });
      let result;
      for await (const chunk of generator) { result = chunk; }
      finalContent = result.choices[0].message.content;
      success = true;
      break;
    } catch (e) { /* next */ }
  }

  if (!success) {
    const generator = routeChatCompletion(model, messages, false, sessionId);
    let result;
    for await (const chunk of generator) { result = chunk; }
    finalContent = (result as any).choices[0].message.content;
  }

  if (sessionId) {
    messages.push({ role: 'assistant', content: finalContent });
    saveSession(sessionId, messages);
  }

  return finalContent;
}

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
              description: "List of 3 models to use",
              default: ["claude-pro", "gemini-advanced", "openrouter:auto"]
            },
          },
          required: ["question"],
        },
      },
      {
        name: "ask_rhea",
        description: "Ask a question to Rhea's orchestrated AI models with optional session persistence.",
        inputSchema: {
          type: "object",
          properties: {
            prompt: { type: "string", description: "The prompt to send" },
            model: { type: "string", description: "Logical model name", default: "claude-pro" },
            session_id: { type: "string", description: "Optional session ID to continue a conversation" }
          },
          required: ["prompt"],
        }
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
      },
      {
        name: "rhea_draw",
        description: "Generate or edit an image using Rhea's image models with optional session persistence.",
        inputSchema: {
          type: "object",
          properties: {
            prompt: { type: "string", description: "The image description or edit instruction" },
            output_path: { type: "string", description: "Where to save the resulting image locally" },
            model: { type: "string", description: "Optional model name", default: "draw" },
            session_id: { type: "string", description: "Optional session ID for multi-turn editing" }
          },
          required: ["prompt", "output_path"],
        },
      }
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const config = loadClientConfig();

  switch (request.params.name) {
    case "ask_rhea": {
      const { prompt, model, session_id } = request.params.arguments as any;
      try {
        const response = await executeRheaPrompt(model || "claude-pro", prompt, session_id);
        return {
          content: [{ type: "text", text: response }],
        };
      } catch (err: any) {
        return {
          content: [{ type: "text", text: `Ask failed: ${err.message}` }],
          isError: true,
        };
      }
    }

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

    case "rhea_draw": {
      const { prompt, output_path, model, session_id } = request.params.arguments as any;
      const { generateImage } = await import('@rhea/lib');
      const fs = await import('fs');
      
      try {
        const orderedServers = getOrderedServers(config);
        let response;
        let success = false;

        for (const server of orderedServers) {
          try {
            const generator = rpc(server, 'draw', { model: model || 'draw', prompt, sessionId: session_id });
            for await (const chunk of generator) { response = chunk; }
            success = true;
            break;
          } catch (e) { /* next */ }
        }

        if (!success) {
          response = await generateImage(model || 'draw', prompt, session_id);
        }

        if (response.data?.[0]?.b64_json) {
          fs.writeFileSync(output_path, Buffer.from(response.data[0].b64_json, 'base64'));
          return {
            content: [{ type: "text", text: `🎨 Image generated and saved to ${output_path}${session_id ? ' (Session: ' + session_id + ')' : ''}` }],
          };
        }
        throw new Error("No image data received");
      } catch (err: any) {
        return {
          content: [{ type: "text", text: `Draw failed: ${err.message}` }],
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
