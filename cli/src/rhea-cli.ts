#!/usr/bin/env node

import fs from 'fs';
import providers from '../../providers.json' with { type: 'json' };
import { 
  loadClientConfig, 
  saveClientConfig, 
  getOrderedServers, 
  rpc, 
  routeChatCompletion,
  getCacheKey,
  getCachedResponse,
  saveToCache,
  clearCache,
  ServerProfile
} from '@rhea/lib';

const args = process.argv.slice(2);
const command = args[0];

// Load configuration
let config = loadClientConfig();

function getActiveServerLabel(): string | null {
  const serverFlagIndex = args.indexOf('--server');
  return serverFlagIndex > -1 ? args[serverFlagIndex + 1] : config.activeServer;
}

// ---- COMMAND: PAIR ----
if (command === 'pair') {
  const label = args[1];
  const host = args[2];
  const tokenIndex = args.indexOf('--token');
  const codeIndex = args.indexOf('--code');
  
  let token = tokenIndex > -1 ? args[tokenIndex + 1] : null;
  const code = codeIndex > -1 ? args[codeIndex + 1] : null;

  if (!label || !host || (!token && !code)) {
    console.log("Usage: \n  rhea-cli pair <label> <user@host> --token <token>\n  rhea-cli pair <label> <user@host> --code <code>");
    process.exit(1);
  }

  (async () => {
    if (code) {
      console.log(`Exchanging code ${code} for token...`);
      // Manual SSH RPC for exchange (bypasses getActiveServer)
      try {
        const tempServer: ServerProfile = { host, token: '' }; // No token yet
        const generator = rpc(tempServer, 'exchange-code', { code });
        let result;
        for await (const chunk of generator) {
          result = chunk;
        }
        token = result.token;
        console.log("✅ Code exchanged successfully.");
      } catch (err: any) {
        console.error(`❌ Failed to exchange code: ${err.message}`);
        process.exit(1);
      }
    }

    if (token) {
      config.servers[label] = { host, token };
      if (!config.activeServer) config.activeServer = label;
      saveClientConfig(config);

      console.log(`✅ Server profile '${label}' paired and saved.`);
      console.log(`To use this server: rhea-cli use ${label}`);
    }
    process.exit(0);
  })();
}

// ---- COMMAND: SERVERS ----
if (command === 'servers') {
  console.log("Configured Rhea Servers:");
  if (Object.keys(config.servers).length === 0) {
    console.log("  (No servers paired)");
  }
  for (const name of Object.keys(config.servers)) {
    const activeMark = name === config.activeServer ? "*" : " ";
    console.log(`${activeMark} ${name} (${config.servers[name].host})`);
  }
  process.exit(0);
}

// ---- COMMAND: USE ----
if (command === 'use') {
  const label = args[1];
  if (!config.servers[label]) {
    console.error(`❌ Error: Server profile '${label}' does not exist.`);
    process.exit(1);
  }
  config.activeServer = label;
  saveClientConfig(config);
  console.log(`✅ Now using server: ${label}`);
  process.exit(0);
}

// ---- COMMAND: ORDER ----
if (command === 'order') {
  const order = args.slice(1).filter(a => !a.startsWith('-'));
  if (order.length === 0) {
    console.log("Usage: rhea-cli order <server1> <server2> ...");
    process.exit(1);
  }
  
  // Validate all servers exist
  for (const name of order) {
    if (!config.servers[name]) {
      console.error(`❌ Error: Server profile '${name}' not found.`);
      process.exit(1);
    }
  }
  
  config.order = order;
  saveClientConfig(config);
  console.log(`✅ Server fallback order updated: ${order.join(' -> ')}`);
  process.exit(0);
}

// ---- COMMAND: STATUS ----
if (command === 'status') {
  const label = getActiveServerLabel();
  const server = label ? config.servers[label] : null;

  if (!server) {
    console.log("Status: Not paired");
    console.log("Hint: run 'rhea-cli pair ...'");
    process.exit(0);
  }

  console.log(`Server:      ${label}`);
  console.log(`Host:        ${server.host}`);
  console.log(`Transport:   SSH over Tailscale`);
  
  (async () => {
    try {
      const generator = rpc(server, 'ping');
      let result;
      for await (const chunk of generator) {
        result = chunk;
      }
      console.log(`Reachability: Online`);
      console.log(`Pairing:      Valid`);
      console.log(`Version:      ${result.version}`);
    } catch (err: any) {
      if (err.message.includes("Server offline")) {
        console.log(`Reachability: Offline`);
        console.log(`Hint: Server may be asleep or disconnected from Tailscale.`);
      } else if (err.message.includes("Unauthorized")) {
        console.log(`Reachability: Online`);
        console.log(`Pairing:      Invalid / Revoked`);
      } else {
        console.log(`Reachability: Error - ${err.message}`);
      }
    }
  })();
}

// ---- COMMAND: CACHE ----
if (command === 'cache' && args[1] === 'clear') {
  clearCache();
  console.log("✅ Cache cleared.");
  process.exit(0);
}

// ---- COMMAND: ASK ----
if (command === 'ask') {
  const modelIndex = args.indexOf('--model');
  const model = modelIndex > -1 ? args[modelIndex + 1] : 'claude-pro';
  
  // Remove --server and --no-cache flags
  const serverFlagIndex = args.indexOf('--server');
  const noCache = args.includes('--no-cache');
  
  let promptArgs = args.filter((arg, i) => {
    if (i === 0) return false; // skip command
    if (i === modelIndex || i === modelIndex + 1) return false;
    if (i === serverFlagIndex || i === serverFlagIndex + 1) return false;
    if (arg === '--no-cache') return false;
    return true;
  });
  
  let prompt = promptArgs.join(' ');

  if (!prompt && !process.stdin.isTTY) {
    let stdinData = '';
    process.stdin.on('data', (chunk: Buffer) => stdinData += chunk);
    process.stdin.on('end', () => runQuery(model, stdinData.trim(), noCache));
  } else {
    runQuery(model, prompt, noCache);
  }
}

// ---- COMMAND: DRAW ----
if (command === 'draw') {
  const outputIndex = args.indexOf('--output');
  const output = outputIndex > -1 ? args[outputIndex + 1] : null;
  const modelIndex = args.indexOf('--model');
  const model = modelIndex > -1 ? args[modelIndex + 1] : 'draw';
  
  const serverFlagLabel = getActiveServerLabel();
  
  let promptArgs = args.filter((arg, i) => {
    if (i === 0) return false;
    if (i === outputIndex || i === outputIndex + 1) return false;
    if (i === modelIndex || i === modelIndex + 1) return false;
    if (arg === '--server' || (i > 0 && args[i-1] === '--server')) return false;
    return true;
  });
  const prompt = promptArgs.join(' ');

  if (!prompt || !output) {
    console.error("❌ Error: Prompt and --output path are required for 'draw'.");
    process.exit(1);
  }

  (async () => {
    try {
      const server = serverFlagLabel ? config.servers[serverFlagLabel] : null;
      let response;

      if (server) {
        const generator = rpc(server, 'draw', { model, prompt });
        for await (const chunk of generator) { response = chunk; }
      } else {
        const { generateImage } = await import('@rhea/lib');
        response = await generateImage(model, prompt);
      }

      if (response.data?.[0]?.b64_json) {
        fs.writeFileSync(output, Buffer.from(response.data[0].b64_json, 'base64'));
        console.log(`🎨 Image saved to: ${output}`);
      } else {
        throw new Error("No image data received from server");
      }
    } catch (err: any) {
      console.error(`❌ Draw failed: ${err.message}`);
      process.exit(1);
    }
  })();
}

// ---- COMMAND: UNPAIR ----
if (command === 'unpair') {
  const label = args[1];
  if (!label) {
    console.log("Usage: rhea-cli unpair <label>");
    process.exit(1);
  }
  if (config.servers[label]) {
    delete config.servers[label];
    if (config.activeServer === label) {
      config.activeServer = Object.keys(config.servers)[0] || null;
    }
    saveClientConfig(config);
    console.log(`🔌 Unpaired server '${label}'.`);
  } else {
    console.error(`❌ Error: Server profile '${label}' not found.`);
  }
  process.exit(0);
}

// ---- COMMAND: LIST ----
if (command === 'list') {
  const label = getActiveServerLabel();
  const server = label ? config.servers[label] : null;
  
  if (server) {
    (async () => {
      try {
        const generator = rpc(server, 'list');
        let result;
        for await (const chunk of generator) {
          result = chunk;
        }
        console.log(`Models available on ${label} (${server.host}):`);
        result.models.forEach((m: string) => console.log(`  - ${m}`));
      } catch (err: any) {
        console.error(err.message);
      }
    })();
  } else {
    console.log("Available local models:");
    const providersObj = providers as Record<string, any>;
    Object.keys(providersObj).forEach(m => console.log(`  - ${m}`));
  }
} else if (!['pair', 'status', 'ask', 'list', 'unpair', 'servers', 'use', 'order', 'cache', 'draw'].includes(command as string)) {
  console.log(`Usage: 
  rhea-cli pair <label> <host> --token <token>
  rhea-cli pair <label> <host> --code <code>
  rhea-cli servers
  rhea-cli use <label>
  rhea-cli order <server1> <server2> ...
  rhea-cli status [--server <label>]
  rhea-cli draw [--server <label>] [--model <model>] --output <path.png> <prompt>
  rhea-cli unpair <label>
  rhea-cli list [--server <label>]
  rhea-cli ask [--server <label>] [--model <model>] [--no-cache] <prompt>
  rhea-cli cache clear`);
}

async function runQuery(model: string, prompt: string, noCache: boolean = false) {
  const messages = [{ role: 'user', content: prompt }];
  const cacheKey = getCacheKey(model, messages);
  
  if (!noCache) {
    const cached = getCachedResponse(cacheKey);
    if (cached) {
      console.log("(served from cache)");
      console.log(cached.choices[0].message.content);
      return;
    }
  }

  const labelOverride = getActiveServerLabel();
  let finalContent = '';
  
  if (labelOverride && config.servers[labelOverride]) {
    // Direct target
    try {
      const generator = rpc(config.servers[labelOverride], 'ask', { model, messages, stream: true });
      for await (const chunk of generator) {
        const anyChunk = chunk as any;
        if (anyChunk.choices?.[0]?.delta?.content) {
          const c = anyChunk.choices[0].delta.content;
          finalContent += c;
          process.stdout.write(c);
        }
      }
      process.stdout.write('\n');
      saveToCache(cacheKey, { choices: [{ message: { role: 'assistant', content: finalContent } }] });
      return;
    } catch (err: any) {
      console.error(`❌ Error on targeted server ${labelOverride}: ${err.message}`);
      process.exit(1);
    }
  }

  // Fallback Loop
  const orderedServers = getOrderedServers(config);
  
  for (const server of orderedServers) {
    try {
      const generator = rpc(server, 'ask', { model, messages, stream: true });
      for await (const chunk of generator) {
        const anyChunk = chunk as any;
        if (anyChunk.choices?.[0]?.delta?.content) {
          const c = anyChunk.choices[0].delta.content;
          finalContent += c;
          process.stdout.write(c);
        }
      }
      process.stdout.write('\n');
      saveToCache(cacheKey, { choices: [{ message: { role: 'assistant', content: finalContent } }] });
      return; // Success!
    } catch (err: any) {
      console.warn(`⚠️ Server ${server.name} failed/offline, trying next...`);
    }
  }

  // Final Local Fallback
  try {
    const generator = routeChatCompletion(model, messages, true);
    for await (const chunk of generator) {
      const anyChunk = chunk as any;
      if (anyChunk.object === "chat.completion.chunk" && anyChunk.choices?.[0]?.delta?.content) {
        const c = anyChunk.choices[0].delta.content;
        finalContent += c;
        process.stdout.write(c);
      } else if (anyChunk.object === "chat.completion") {
        // Fallback for non-streaming providers if any
        const c = anyChunk.choices[0].message.content;
        finalContent = c;
        process.stdout.write(c);
      }
    }
    process.stdout.write('\n');
    saveToCache(cacheKey, { choices: [{ message: { role: 'assistant', content: finalContent } }] });
  } catch (err: any) {
    console.error(`❌ All servers and local execution failed.`);
    console.error(`   Last error: ${err.message}`);
    process.exit(1);
  }
}
