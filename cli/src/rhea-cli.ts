#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn, execSync } from 'child_process';
import readline from 'readline';
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
  ServerProfile,
  generateSessionId,
  saveSession,
  loadSession,
  loadKeys,
  saveKeys,
  injectEnvKeys
} from '@rhea/lib';
import { generateImage } from '@rhea/images';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const command = args[0];

// Injects keys from keystore into process.env before any model execution
injectEnvKeys();

// Load configuration
let config = loadClientConfig();

function getActiveServerLabel(): string | null {
  const serverFlagIndex = args.indexOf('--server');
  return serverFlagIndex > -1 ? args[serverFlagIndex + 1] : config.activeServer;
}

function showHelp() {
  const readmePath = path.join(__dirname, '../../README.md');
  const readme = fs.existsSync(readmePath) ? fs.readFileSync(readmePath, 'utf8') : '';
  
  console.log(`
Rhea: Your AI Subscriptions, Now Your Private APIs
==================================================

Usage:
  rhea-cli <command> [options]

Commands:
  ask         Ask a question to Rhea's orchestrated models (streams in real-time)
  draw        Generate or edit an image using Nano Banana (Gemini 3.1 Flash Image)
  pair        Enroll a new remote server profile
  servers     List configured server profiles
  use         Switch the active server profile
  order       Set a persistent fallback order for servers
  status      Check connectivity to a server
  list        List available models (local or remote)
  cache       Manage the local prompt cache
  key         Manage API keys in the secure keystore
  doctor      Diagnose the health of your Rhea environment
  setup       Interactive first-time setup wizard
  unpair      Remove a server profile

Global Flags:
  --server <label>    Target a specific server for a single command
  --help              Show this help message and read documentation

List Flags:
  --images            Fetch live image-generation models from OpenRouter

Draw Flags:
  --output <path>     Required: Where to save the generated image
  --model <name>      Optional: The logical image model to use (default: draw)
  --session <id>      Optional: Resume an image editing session
  --new-session       Optional: Start a fresh tracked session
  --aspect-ratio <r>  Optional: e.g. 16:9, 1:1, 4:3
  --size <s|2k|4k>    Optional: e.g. 1k, 2k, 4k

Examples:
  rhea-cli ask "Explain quantum entanglement"
  rhea-cli draw "A cyberpunk city" --output city.png --new-session --aspect-ratio 16:9
  rhea-cli order primary-vps home-server mac-laptop
  rhea-cli pair my-mac user@mac-host --code B3F2A1

---
DOCUMENTATION (README.md):
---
${readme.split('## 🚀 Getting Started')[0]}
  `);
}

if (args.includes('--help')) {
  showHelp();
  process.exit(0);
}

// ---- COMMAND: KEY ----
if (command === 'key') {
  (async () => {
    const subCommand = args[1];
    const keys = loadKeys();

    if (subCommand === 'set') {
      let name = args[2];
      let value = args[3];

      if (!name || !value) {
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        const ask = (q: string): Promise<string> => new Promise(res => rl.question(q, res));
        
        console.log("\n🔑 Add a Key to the Secure Keystore");
        console.log("Common names: OPENROUTER_API_KEY, OPENAI_API_KEY, STABILITY_API_KEY, FAL_KEY\n");
        
        if (!name) name = await ask("Key Name: ");
        if (!value) value = await ask("Key Value: ");
        rl.close();
      }

      if (name && value) {
        keys[name] = value;
        saveKeys(keys);
        console.log(`✅ Key '${name}' saved to secure keystore.`);
      } else {
        console.error("❌ Error: Both name and value are required.");
      }
    } else if (subCommand === 'list') {
      console.log("Configured Keys:");
      for (const name of Object.keys(keys)) {
        console.log(`  - ${name}: ************`);
      }
    } else if (subCommand === 'remove') {
      const name = args[2];
      if (keys[name]) {
        delete keys[name];
        saveKeys(keys);
        console.log(`✅ Key '${name}' removed.`);
      } else {
        console.error(`❌ Key '${name}' not found.`);
      }
    } else {
      console.log("Usage: rhea-cli key [set|list|remove]");
    }
    process.exit(0);
  })();
}

// ---- COMMAND: DOCTOR ----
if (command === 'doctor') {
  (async () => {
    console.log("🩺 Rhea Diagnostic Report\n");

    // 1. Check binaries
    const binaries = ['claude', 'gemini', 'ssh'];
    for (const bin of binaries) {
      try {
        execSync(`which ${bin}`, { stdio: 'ignore' });
        console.log(`✅ ${bin.padEnd(10)} : Installed`);
      } catch (e) {
        console.warn(`⚠️ ${bin.padEnd(10)} : NOT FOUND (Some features will be limited)`);
      }
    }

    // 2. Check keys
    const keys = loadKeys();
    const requiredKeys = ['OPENROUTER_API_KEY', 'OPENAI_API_KEY', 'STABILITY_API_KEY', 'FAL_KEY'];
    console.log("\nSecrets:");
    for (const key of requiredKeys) {
      if (keys[key]) console.log(`✅ ${key.padEnd(20)} : Configured`);
      else console.log(`⚪ ${key.padEnd(20)} : Not set`);
    }

    // 3. Check servers
    console.log("\nServers:");
    for (const [name, server] of Object.entries(config.servers)) {
      try {
        const generator = rpc(server, 'ping');
        for await (const _ of generator) { /* ping */ }
        console.log(`✅ ${name.padEnd(15)} : Online (${server.host})`);
      } catch (e: any) {
        console.log(`❌ ${name.padEnd(15)} : Offline - ${e.message}`);
      }
    }

    console.log("\nDone.");
    process.exit(0);
  })();
}

// ---- COMMAND: SETUP (INTERACTIVE) ----
if (command === 'setup') {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q: string): Promise<string> => new Promise(res => rl.question(q, res));

  (async () => {
    console.log("\n🚀 Welcome to the Rhea Setup Wizard\n");

    // 1. CLI Authentication
    console.log("Step 1: Local CLI Authentication");
    const useClaude = (await ask("Do you want to use Claude Pro? (y/n): ")).toLowerCase() === 'y';
    if (useClaude) {
      console.log("Please ensure you have run 'claude login' in your terminal.");
    }
    
    const useGemini = (await ask("Do you want to use Gemini Advanced / Image Generation? (y/n): ")).toLowerCase() === 'y';
    if (useGemini) {
      console.log("Please ensure you have run 'gemini login' or configured your credentials.");
    }

    // 2. API Keys
    console.log("\nStep 2: Cloud API Configuration");
    const keys = loadKeys();
    
    console.log("Rhea requires specific keys for cloud models. Press enter to skip a provider.\n");
    
    const orKey = await ask("OpenRouter API Key (for Llama 3, Flux Pro, etc.): ");
    if (orKey) keys['OPENROUTER_API_KEY'] = orKey;
    
    const oaKey = await ask("OpenAI API Key (for DALL-E 3, GPT-4o, etc.): ");
    if (oaKey) keys['OPENAI_API_KEY'] = oaKey;

    const stKey = await ask("Stability AI API Key (for SD3): ");
    if (stKey) keys['STABILITY_API_KEY'] = stKey;

    const flKey = await ask("FAL.ai Key (for high-speed Flux): ");
    if (flKey) keys['FAL_KEY'] = flKey;
    
    saveKeys(keys);

    // 3. Initial Server
    console.log("\nStep 3: Remote Server Pairing");
    const pairNow = (await ask("Do you want to pair with a remote server now? (y/n): ")).toLowerCase() === 'y';
    if (pairNow) {
      const label = await ask("Enter server label (e.g. mac): ");
      const host = await ask("Enter server host (e.g. user@mac-host): ");
      const code = await ask("Enter 6-char pairing code from the server: ");
      
      console.log(`Pairing with ${label}...`);
      try {
        const tempServer = { host, token: "" };
        const generator = rpc(tempServer, 'exchange-code', { code });
        let result;
        for await (const chunk of generator) { result = chunk; }
        
        config.servers[label] = { host, token: result.token };
        config.activeServer = label;
        saveClientConfig(config);
        console.log(`✅ Successfully paired with ${label}`);
      } catch (err: any) {
        console.error(`❌ Pairing failed: ${err.message}`);
      }
    }

    console.log("\n✨ Setup complete! Try running 'rhea-cli doctor' to verify your environment.");
    rl.close();
    process.exit(0);
  })();
}

// ---- COMMAND: PAIR ----
if (command === 'pair' && !['setup'].includes(command)) { // Handled separately or as standalone
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
  
  const serverFlagIndex = args.indexOf('--server');
  const noCache = args.includes('--no-cache');
  
  const sessionIndex = args.indexOf('--session');
  const newSession = args.includes('--new-session');
  let sessionId = sessionIndex > -1 ? args[sessionIndex + 1] : (newSession ? generateSessionId() : null);

  let promptArgs = args.filter((arg, i) => {
    if (i === 0) return false;
    if (i === modelIndex || i === modelIndex + 1) return false;
    if (i === serverFlagIndex || i === serverFlagIndex + 1) return false;
    if (i === sessionIndex || i === sessionIndex + 1) return false;
    if (arg === '--no-cache' || arg === '--new-session') return false;
    return true;
  });
  
  let prompt = promptArgs.join(' ');

  if (!prompt && !process.stdin.isTTY) {
    let stdinData = '';
    process.stdin.on('data', (chunk: Buffer) => stdinData += chunk);
    process.stdin.on('end', () => runQuery(model, stdinData.trim(), { noCache, sessionId }));
  } else {
    runQuery(model, prompt, { noCache, sessionId });
  }
}

// ---- COMMAND: DRAW ----
if (command === 'draw') {
  const outputIndex = args.indexOf('--output');
  const output = outputIndex > -1 ? args[outputIndex + 1] : null;
  const modelIndex = args.indexOf('--model');
  const model = modelIndex > -1 ? args[modelIndex + 1] : 'draw';
  const ratioIndex = args.indexOf('--aspect-ratio');
  const aspectRatio = ratioIndex > -1 ? args[ratioIndex + 1] : undefined;
  const sizeIndex = args.indexOf('--size');
  const size = sizeIndex > -1 ? args[sizeIndex + 1] : undefined;
  
  const serverFlagLabel = getActiveServerLabel();

  const sessionIndex = args.indexOf('--session');
  const newSession = args.includes('--new-session');
  let sessionId = sessionIndex > -1 ? args[sessionIndex + 1] : (newSession ? generateSessionId() : null);
  
  let promptArgs = args.filter((arg, i) => {
    if (i === 0) return false;
    if (i === outputIndex || i === outputIndex + 1) return false;
    if (i === modelIndex || i === modelIndex + 1) return false;
    if (arg === '--server' || (i > 0 && args[i-1] === '--server')) return false;
    if (i === sessionIndex || i === sessionIndex + 1) return false;
    if (i === ratioIndex || i === ratioIndex + 1) return false;
    if (i === sizeIndex || i === sizeIndex + 1) return false;
    if (arg === '--new-session') return false;
    return true;
  });
  const prompt = promptArgs.join(' ');

  if (!prompt || !output) {
    console.error("❌ Error: Prompt and --output path are required for 'draw'.");
    process.exit(1);
  }

  (async () => {
    try {
      if (sessionId && newSession) console.log(`🆕 Starting new session: ${sessionId}`);
      else if (sessionId) console.log(`💬 Using session: ${sessionId}`);

      const server = serverFlagLabel ? config.servers[serverFlagLabel] : null;
      let response;

      const drawOpts = { 
        modelReq: model, 
        prompt, 
        sessionId: sessionId || undefined,
        aspectRatio,
        size
      };

      if (server) {
        const generator = rpc(server, 'draw', drawOpts);
        for await (const chunk of generator) { response = chunk; }
      } else {
        response = await generateImage(drawOpts, providers as any);
      }

      if (response.data?.[0]?.b64_json) {
        fs.writeFileSync(output, Buffer.from(response.data[0].b64_json, 'base64'));
        console.log(`🎨 Image saved to: ${output}`);
        if (sessionId) console.log(`🔗 Session ID: ${sessionId} (use with --session to edit)`);
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
  const showImages = args.includes('--images');
  const label = getActiveServerLabel();
  const server = label ? config.servers[label] : null;
  
  if (showImages) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      console.error("❌ Error: OPENROUTER_API_KEY is required to discovery remote image models.");
      process.exit(1);
    }
    (async () => {
      try {
        console.log("Fetching live image models from OpenRouter...");
        const res = await fetch("https://openrouter.ai/api/v1/models?output_modalities=image");
        const data = await res.json() as any;
        console.log("Available OpenRouter Image Models:");
        data.data.forEach((m: any) => console.log(`  - ${m.id} (${m.name})`));
      } catch (err: any) {
        console.error(`❌ Discovery failed: ${err.message}`);
      }
    })();
  } else if (server) {
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
} else if (!['pair', 'status', 'ask', 'list', 'unpair', 'servers', 'use', 'order', 'cache', 'draw', 'key', 'doctor', 'setup'].includes(command as string)) {
  showHelp();
}

async function runQuery(model: string, prompt: string, opts: { noCache?: boolean, sessionId?: string | null } = {}) {
  const history = opts.sessionId ? loadSession(opts.sessionId) : [];
  const messages = [...history, { role: 'user', content: prompt }];
  
  if (opts.sessionId && !history.length) console.log(`🆕 Starting new session: ${opts.sessionId}`);
  else if (opts.sessionId) console.log(`💬 Resuming session: ${opts.sessionId}`);

  const cacheKey = getCacheKey(model, messages);
  
  if (!opts.noCache) {
    const cached = getCachedResponse(cacheKey);
    if (cached) {
      console.log("(served from cache)");
      console.log(cached.choices[0].message.content);
      return;
    }
  }

  const labelOverride = getActiveServerLabel();
  let finalContent = '';
  
  const handleChunk = (chunk: any) => {
    if (chunk.choices?.[0]?.delta?.content) {
      const c = chunk.choices[0].delta.content;
      finalContent += c;
      process.stdout.write(c);
    } else if (chunk.object === "chat.completion") {
      const c = chunk.choices[0].message.content;
      finalContent = c;
      process.stdout.write(c);
    }
  };

  if (labelOverride && config.servers[labelOverride]) {
    try {
      const generator = rpc(config.servers[labelOverride], 'ask', { model, messages, stream: true, sessionId: opts.sessionId });
      for await (const chunk of generator) { handleChunk(chunk); }
      process.stdout.write('\n');
      saveToCache(cacheKey, { choices: [{ message: { role: 'assistant', content: finalContent } }] });
      if (opts.sessionId) {
        messages.push({ role: 'assistant', content: finalContent });
        saveSession(opts.sessionId, messages);
        console.log(`🔗 Session ID: ${opts.sessionId}`);
      }
      return;
    } catch (err: any) {
      console.error(`❌ Error on targeted server ${labelOverride}: ${err.message}`);
      process.exit(1);
    }
  }

  const orderedServers = getOrderedServers(config);
  for (const server of orderedServers) {
    try {
      const generator = rpc(server, 'ask', { model, messages, stream: true, sessionId: opts.sessionId });
      for await (const chunk of generator) { handleChunk(chunk); }
      process.stdout.write('\n');
      saveToCache(cacheKey, { choices: [{ message: { role: 'assistant', content: finalContent } }] });
      if (opts.sessionId) {
        messages.push({ role: 'assistant', content: finalContent });
        saveSession(opts.sessionId, messages);
        console.log(`🔗 Session ID: ${opts.sessionId}`);
      }
      return;
    } catch (err: any) {
      console.warn(`⚠️ Server ${server.name} failed/offline, trying next...`);
    }
  }

  try {
    const generator = routeChatCompletion(model, messages, true, opts.sessionId || undefined);
    for await (const chunk of generator) { handleChunk(chunk); }
    process.stdout.write('\n');
    saveToCache(cacheKey, { choices: [{ message: { role: 'assistant', content: finalContent } }] });
    if (opts.sessionId) {
      messages.push({ role: 'assistant', content: finalContent });
      saveSession(opts.sessionId, messages);
      console.log(`🔗 Session ID: ${opts.sessionId}`);
    }
  } catch (err: any) {
    console.error(`❌ All servers and local execution failed.`);
    console.error(`   Last error: ${err.message}`);
    process.exit(1);
  }
}
