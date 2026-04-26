#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
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
  injectEnvKeys,
  Pod
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
  debate      Run a multi-model Socratic debate (Intelligence Pod)
  code        Orchestrate automated code generation and verification
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
  rhea-cli debate "Should we build a Dyson sphere?"
  rhea-cli code "Write a Rust function to calculate the Fibonacci sequence safely"
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
        
        console.log("\n🔑 Add an API Key to Rhea");

        const envKeysSet = new Set<string>();
        Object.values(providers as Record<string, any>).forEach(p => {
          if (p.api_key_env) envKeysSet.add(p.api_key_env);
        });
        const sortedEnvKeys = Array.from(envKeysSet).sort();

        if (!name) {
          console.log("Please select which provider key you want to set:");
          sortedEnvKeys.forEach((envName, i) => {
            console.log(`  [${i + 1}] ${envName}`);
          });
          console.log(`  [${sortedEnvKeys.length + 1}] Custom Key Name`);

          const choice = await ask("\nChoice: ");
          const idx = parseInt(choice) - 1;

          if (idx >= 0 && idx < sortedEnvKeys.length) {
            name = sortedEnvKeys[idx];
          } else if (idx === sortedEnvKeys.length) {
            name = await ask("Enter custom key name: ");
          } else {
            console.error("❌ Invalid choice.");
            rl.close();
            process.exit(1);
          }
        }

        if (!value) {
          value = await ask(`Enter value for ${name}: `);
        }
        rl.close();
      }

      if (name && value) {
        keys[name] = value;
        saveKeys(keys);
        console.log(`✅ Key for ${name} saved to secure keystore.`);
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
else if (command === 'doctor') {
  (async () => {
    console.log("🩺 Rhea Diagnostic Report\n");

    const binaries = ['claude', 'gemini', 'ssh'];
    for (const bin of binaries) {
      try {
        execSync(`which ${bin}`, { stdio: 'ignore' });
        console.log(`✅ ${bin.padEnd(10)} : Installed`);
      } catch (e) {
        console.warn(`⚠️ ${bin.padEnd(10)} : NOT FOUND (Some features will be limited)`);
      }
    }

    const keys = loadKeys();
    const requiredKeys = ['OPENROUTER_API_KEY', 'OPENAI_API_KEY', 'STABILITY_API_KEY', 'FAL_KEY'];
    console.log("\nSecrets:");
    for (const key of requiredKeys) {
      if (keys[key]) console.log(`✅ ${key.padEnd(20)} : Configured`);
      else console.log(`⚪ ${key.padEnd(20)} : Not set`);
    }

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

// ---- COMMAND: SETUP ----
else if (command === 'setup') {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q: string): Promise<string> => new Promise(res => rl.question(q, res));

  (async () => {
    console.log("\n🚀 Welcome to the Rhea Setup Wizard\n");

    console.log("Step 1: Local CLI Authentication");
    const useClaude = (await ask("Do you want to use Claude Pro? (y/n): ")).toLowerCase() === 'y';
    if (useClaude) console.log("Please ensure you have run 'claude login' in your terminal.");
    
    const useGemini = (await ask("Do you want to use Gemini Advanced? (y/n): ")).toLowerCase() === 'y';
    if (useGemini) console.log("Please ensure you have run 'gemini login'.");

    console.log("\nStep 2: Cloud API Configuration");
    const keys = loadKeys();
    
    const orKey = await ask("OpenRouter API Key (press enter to skip): ");
    if (orKey) keys['OPENROUTER_API_KEY'] = orKey;
    
    const oaKey = await ask("OpenAI API Key (press enter to skip): ");
    if (oaKey) keys['OPENAI_API_KEY'] = oaKey;
    
    saveKeys(keys);

    console.log("\nStep 3: Remote Server Pairing");
    const pairNow = (await ask("Do you want to pair with a remote server? (y/n): ")).toLowerCase() === 'y';
    if (pairNow) {
      const label = await ask("Enter server label: ");
      const host = await ask("Enter server host (user@host): ");
      const code = await ask("Enter pairing code: ");
      
      console.log(`Pairing with ${label}...`);
      try {
        const tempServer = { host, token: "" };
        const generator = rpc(tempServer, 'exchange-code', { code });
        let result: any;
        for await (const chunk of generator) { result = chunk; }
        config.servers[label] = { host, token: result.token };
        config.activeServer = label;
        saveClientConfig(config);
        console.log(`✅ Successfully paired with ${label}`);
      } catch (err: any) {
        console.error(`❌ Pairing failed: ${err.message}`);
      }
    }

    console.log("\n✨ Setup complete! Run 'rhea-cli doctor' to verify.");
    rl.close();
    process.exit(0);
  })();
}

// ---- COMMAND: PAIR ----
else if (command === 'pair') {
  const label = args[1];
  const host = args[2];
  const tokenIndex = args.indexOf('--token');
  const codeIndex = args.indexOf('--code');
  
  let token = tokenIndex > -1 ? args[tokenIndex + 1] : null;
  const code = codeIndex > -1 ? args[codeIndex + 1] : null;

  if (!label || !host || (!token && !code)) {
    console.log("Usage: \n  rhea-cli pair <label> <host> --token <token>\n  rhea-cli pair <label> <host> --code <code>");
    process.exit(1);
  }

  (async () => {
    if (code) {
      try {
        const tempServer = { host, token: '' };
        const generator = rpc(tempServer, 'exchange-code', { code });
        let result: any;
        for await (const chunk of generator) { result = chunk; }
        token = result.token;
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
    }
    process.exit(0);
  })();
}

// ---- COMMAND: SERVERS ----
else if (command === 'servers') {
  for (const name of Object.keys(config.servers)) {
    const activeMark = name === config.activeServer ? "*" : " ";
    console.log(`${activeMark} ${name} (${config.servers[name].host})`);
  }
  process.exit(0);
}

// ---- COMMAND: USE ----
else if (command === 'use') {
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
else if (command === 'order') {
  const order = args.slice(1).filter(a => !a.startsWith('-'));
  for (const name of order) {
    if (!config.servers[name]) {
      console.error(`❌ Error: Server profile '${name}' not found.`);
      process.exit(1);
    }
  }
  config.order = order;
  saveClientConfig(config);
  console.log(`✅ Server fallback order updated.`);
  process.exit(0);
}

// ---- COMMAND: STATUS ----
else if (command === 'status') {
  const label = getActiveServerLabel();
  const server = label ? config.servers[label] : null;
  if (!server) {
    console.log("Status: Not paired");
    process.exit(0);
  }
  (async () => {
    try {
      const generator = rpc(server, 'ping');
      let result: any;
      for await (const chunk of generator) { result = chunk; }
      console.log(`Server: ${label}\nReachability: Online\nVersion: ${result.version}`);
    } catch (err: any) {
      console.log(`Server: ${label}\nReachability: Offline (${err.message})`);
    }
    process.exit(0);
  })();
}

// ---- COMMAND: CACHE ----
else if (command === 'cache' && args[1] === 'clear') {
  clearCache();
  console.log("✅ Cache cleared.");
  process.exit(0);
}

// ---- COMMAND: ASK ----
else if (command === 'ask') {
  const modelIndex = args.indexOf('--model');
  const model = modelIndex > -1 ? args[modelIndex + 1] : 'claude-pro';
  const noCache = args.includes('--no-cache');
  const sessionIndex = args.indexOf('--session');
  const newSession = args.includes('--new-session');
  let sessionId = sessionIndex > -1 ? args[sessionIndex + 1] : (newSession ? generateSessionId() : null);

  let promptArgs = args.filter((arg, i) => {
    if (i === 0) return false;
    if (i === modelIndex || i === modelIndex + 1) return false;
    if (arg === '--server' || (i > 0 && args[i-1] === '--server')) return false;
    if (i === sessionIndex || i === sessionIndex + 1) return false;
    if (arg === '--no-cache' || arg === '--new-session') return false;
    return true;
  });
  let prompt = promptArgs.join(' ');
  runQuery(model, prompt, { noCache, sessionId });
}

// ---- COMMAND: DRAW ----
else if (command === 'draw') {
  const outputIndex = args.indexOf('--output');
  const output = outputIndex > -1 ? args[outputIndex + 1] : null;
  const modelIndex = args.indexOf('--model');
  const model = modelIndex > -1 ? args[modelIndex + 1] : 'draw';
  const ratioIndex = args.indexOf('--aspect-ratio');
  const aspectRatio = ratioIndex > -1 ? args[ratioIndex + 1] : undefined;
  const sizeIndex = args.indexOf('--size');
  const size = sizeIndex > -1 ? args[sizeIndex + 1] : undefined;
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
    console.error("❌ Error: Prompt and --output path are required.");
    process.exit(1);
  }

  (async () => {
    try {
      const serverFlagLabel = getActiveServerLabel();
      const server = serverFlagLabel ? config.servers[serverFlagLabel] : null;
      let response: any;
      const drawOpts = { modelReq: model, prompt, sessionId: sessionId || undefined, aspectRatio, size };

      if (server) {
        const generator = rpc(server, 'draw', drawOpts);
        for await (const chunk of generator) { response = chunk; }
      } else {
        response = await generateImage(drawOpts, providers as any);
      }

      if (response.data?.[0]?.b64_json) {
        fs.writeFileSync(output, Buffer.from(response.data[0].b64_json, 'base64'));
        console.log(`🎨 Image saved to: ${output}`);
      } else {
        throw new Error("No image data received");
      }
      process.exit(0);
    } catch (err: any) {
      console.error(`❌ Draw failed: ${err.message}`);
      process.exit(1);
    }
  })();
}

// ---- COMMAND: DEBATE ----
else if (command === 'debate') {
  const modelArgsIndex = args.indexOf('--models');
  const models = modelArgsIndex > -1 ? args[modelArgsIndex + 1].split(',') : undefined;
  let promptArgs = args.filter((arg, i) => {
    if (i === 0) return false;
    if (i === modelArgsIndex || i === modelArgsIndex + 1) return false;
    if (arg === '--server' || (i > 0 && args[i-1] === '--server')) return false;
    return true;
  });
  const question = promptArgs.join(' ');

  (async () => {
    const availableModels = Object.keys(providers).filter(m => m !== 'draw');
    const pod = new Pod(models || availableModels.slice(0, 3), config);
    try {
      const result = await pod.debate(question);
      console.log(`\n🏆 FINAL DECISION:\n${result.decision}`);
      process.exit(0);
    } catch (err: any) {
      console.error(`❌ Debate failed: ${err.message}`);
      process.exit(1);
    }
  })();
}

// ---- COMMAND: LIST ----
else if (command === 'list') {
  const showImages = args.includes('--images');
  const label = getActiveServerLabel();
  const server = label ? config.servers[label] : null;
  if (showImages) {
    (async () => {
      const res = await fetch("https://openrouter.ai/api/v1/models?output_modalities=image");
      const data = await res.json() as any;
      data.data.forEach((m: any) => console.log(`  - ${m.id}`));
      process.exit(0);
    })();
  } else if (server) {
    (async () => {
      const generator = rpc(server, 'list');
      let result: any;
      for await (const chunk of generator) { result = chunk; }
      result.models.forEach((m: string) => console.log(`  - ${m}`));
      process.exit(0);
    })();
  } else {
    Object.keys(providers).forEach(m => console.log(`  - ${m}`));
    process.exit(0);
  }
}

else if (command === 'code') {
  const modelArgsIndex = args.indexOf('--models');
  const models = modelArgsIndex > -1 ? args[modelArgsIndex + 1].split(',') : undefined;
  const outputIndex = args.indexOf('--output');
  const output = outputIndex > -1 ? args[outputIndex + 1] : null;

  let promptArgs = args.filter((arg, i) => {
    if (i === 0) return false;
    if (i === modelArgsIndex || i === modelArgsIndex + 1) return false;
    if (i === outputIndex || i === outputIndex + 1) return false;
    if (arg === '--server' || (i > 0 && args[i-1] === '--server')) return false;
    return true;
  });
  let requirement = promptArgs.join(' ');

  // Smart Discovery: Look for filenames mentioned in the requirement
  const words = requirement.split(/\s+/);
  const foundFiles = new Set<string>();

  for (const word of words) {
    const cleanWord = word.replace(/[`,!"']/g, '');
    if (fs.existsSync(cleanWord) && fs.statSync(cleanWord).isFile()) {
      foundFiles.add(cleanWord);
    } else if (cleanWord.includes('.') && cleanWord.length > 3) {
      // Try to find the file in subdirectories (limit to 3 levels for speed/safety)
      try {
        const found = execSync(`find . -maxdepth 3 -name "${cleanWord}" -not -path "*/node_modules/*" -not -path "*/dist/*"`, { encoding: 'utf8' }).trim().split('\n').filter(f => f.length > 0);
        if (found.length === 1) {
          foundFiles.add(found[0]);
        } else if (found.length > 1) {
          console.error(`❌ Ambiguity Error: Multiple files match '${cleanWord}':`);
          found.forEach(f => console.error(`   - ${f}`));
          console.error(`   Please use the full relative path to ensure sovereign precision.`);
          process.exit(1);
        }
      } catch (e) { /* ignore find errors */ }
    }
  }

  if (foundFiles.size > 0) {
    let contextBundle = "";
    for (const file of foundFiles) {
      console.log(`📖 Adding local context from: ${file}`);
      contextBundle += `FILE: ${file}\n---\n${fs.readFileSync(file, 'utf8')}\n---\n\n`;
    }
    requirement = `${contextBundle}REQUIRMENT: ${requirement}`;
  }

  (async () => {
    const { Pod } = await import('@rhea/lib');
    const availableModels = Object.keys(providers).filter(m => m !== 'draw');
    const pod = new Pod(models || availableModels.slice(0, 3), config);
    try {
      console.log("🛠️  Rhea is orchestrating implementation and audit...\n");
      const result = await pod.debate(requirement, { mode: 'code' });
      
      const lastRound = result.rounds[result.rounds.length - 1];
      console.log("--- 💎 ARCHITECT PROPOSAL ---");
      console.log(lastRound.proposal.slice(0, 300) + "...");
      console.log("\n--- 🤔 AUDITOR CRITIQUE ---");
      console.log(lastRound.critique.slice(0, 300) + "...");
      console.log("\n--- 🏆 FINAL VERIFIED CODE ---");
      
      let finalCode = result.decision;
      if (!finalCode) throw new Error("No code was generated by the Integrator");

      // Strip markdown code blocks if present
      if (finalCode.includes('```')) {
        const lines = finalCode.split('\n');
        finalCode = lines.filter(l => !l.trim().startsWith('```')).join('\n').trim();
      }

      console.log(finalCode);

      if (output) {
        fs.writeFileSync(output, finalCode);
        console.log(`\n✅ Verified code written to: ${output}`);
      }
      process.exit(0);
    } catch (err: any) {
      console.error(`❌ Coding orchestration failed: ${err.message}`);
      process.exit(1);
    }
  })();
}

else if (command === 'unpair') {
  const label = args[1];
  if (config.servers[label]) {
    delete config.servers[label];
    saveClientConfig(config);
    console.log(`🔌 Unpaired server '${label}'.`);
  }
  process.exit(0);
}

// Default Help
else {
  showHelp();
}

async function runQuery(model: string, prompt: string, opts: { noCache?: boolean, sessionId?: string | null } = {}) {
  const history = opts.sessionId ? loadSession(opts.sessionId) : [];
  const messages = [...history, { role: 'user', content: prompt }];
  const cacheKey = getCacheKey(model, messages);
  
  if (!opts.noCache) {
    const cached = getCachedResponse(cacheKey);
    if (cached) {
      console.log("(served from cache)");
      console.log(cached.choices[0].message.content);
      return;
    }
  }

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

  const labelOverride = getActiveServerLabel();
  if (labelOverride && config.servers[labelOverride]) {
    try {
      const generator = rpc(config.servers[labelOverride], 'ask', { model, messages, stream: true, sessionId: opts.sessionId });
      for await (const chunk of generator) { handleChunk(chunk); }
      process.stdout.write('\n');
      saveToCache(cacheKey, { choices: [{ message: { role: 'assistant', content: finalContent } }] });
      if (opts.sessionId) {
        messages.push({ role: 'assistant', content: finalContent });
        saveSession(opts.sessionId, messages);
      }
      process.exit(0);
    } catch (err: any) {
      console.error(`❌ Error: ${err.message}`);
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
      }
      process.exit(0);
    } catch (e) { /* fallback */ }
  }

  try {
    const generator = routeChatCompletion(model, messages, true, opts.sessionId || undefined);
    for await (const chunk of generator) { handleChunk(chunk); }
    process.stdout.write('\n');
    saveToCache(cacheKey, { choices: [{ message: { role: 'assistant', content: finalContent } }] });
    if (opts.sessionId) {
      messages.push({ role: 'assistant', content: finalContent });
      saveSession(opts.sessionId, messages);
    }
    process.exit(0);
  } catch (err: any) {
    console.error(`❌ Failed: ${err.message}`);
    process.exit(1);
  }
}
