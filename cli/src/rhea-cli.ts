#!/usr/bin/env node

import providers from '../../providers.json' with { type: 'json' };
import { 
  loadClientConfig, 
  saveClientConfig, 
  getOrderedServers, 
  rpc, 
  routeChatCompletion,
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
  const token = tokenIndex > -1 ? args[tokenIndex + 1] : null;

  if (!label || !host || !token) {
    console.log("Usage: rhea-cli pair <label> <user@host> --token <token>");
    process.exit(1);
  }

  config.servers[label] = { host, token };
  if (!config.activeServer) config.activeServer = label;
  saveClientConfig(config);

  console.log(`✅ Server profile '${label}' paired and saved.`);
  console.log(`To use this server: rhea-cli use ${label}`);
  process.exit(0);
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
  
  rpc(server, 'ping').then(res => {
    console.log(`Reachability: Online`);
    console.log(`Pairing:      Valid`);
    console.log(`Version:      ${res.version}`);
  }).catch(err => {
    if (err.message.includes("Server offline")) {
      console.log(`Reachability: Offline`);
      console.log(`Hint: Server may be asleep or disconnected from Tailscale.`);
    } else if (err.message.includes("Unauthorized")) {
      console.log(`Reachability: Online`);
      console.log(`Pairing:      Invalid / Revoked`);
    } else {
      console.log(`Reachability: Error - ${err.message}`);
    }
  });
}

// ---- COMMAND: ASK ----
if (command === 'ask') {
  const modelIndex = args.indexOf('--model');
  const model = modelIndex > -1 ? args[modelIndex + 1] : 'claude-pro';
  
  // Remove --server flag and its value from prompt if present
  const serverIndex = args.indexOf('--server');
  let promptArgs = args.filter((_, i) => i !== modelIndex && i !== modelIndex + 1 && i !== 0);
  if (serverIndex > -1) {
    promptArgs = promptArgs.filter((_, i) => i !== serverIndex && i !== serverIndex + 1);
  }
  let prompt = promptArgs.join(' ');

  if (!prompt && !process.stdin.isTTY) {
    let stdinData = '';
    process.stdin.on('data', (chunk: Buffer) => stdinData += chunk);
    process.stdin.on('end', () => runQuery(model, stdinData.trim()));
  } else {
    runQuery(model, prompt);
  }
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
    rpc(server, 'list').then(res => {
      console.log(`Models available on ${label} (${server.host}):`);
      res.models.forEach((m: string) => console.log(`  - ${m}`));
    }).catch(err => console.error(err.message));
  } else {
    console.log("Available local models:");
    const providersObj = providers as Record<string, any>;
    Object.keys(providersObj).forEach(m => console.log(`  - ${m}`));
  }
} else if (!['pair', 'status', 'ask', 'list', 'unpair', 'servers', 'use'].includes(command)) {
  console.log(`Usage: 
  rhea-cli pair <label> <host> --token <token>
  rhea-cli servers
  rhea-cli use <label>
  rhea-cli order <server1> <server2> ...
  rhea-cli status [--server <label>]
  rhea-cli unpair <label>
  rhea-cli list [--server <label>]
  rhea-cli ask [--server <label>] [--model <model>] <prompt>`);
}

async function runQuery(model: string, prompt: string) {
  const labelOverride = getActiveServerLabel();
  
  if (labelOverride && config.servers[labelOverride]) {
    // Direct target
    try {
      const res = await rpc(config.servers[labelOverride], 'ask', { model, messages: [{ role: 'user', content: prompt }] });
      console.log(res.choices[0].message.content);
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
      const res = await rpc(server, 'ask', { model, messages: [{ role: 'user', content: prompt }] });
      console.log(res.choices[0].message.content);
      return; // Success!
    } catch (err: any) {
      console.warn(`⚠️ Server ${server.name} failed/offline, trying next...`);
    }
  }

  // Final Local Fallback
  try {
    const res = await routeChatCompletion(model, [{ role: 'user', content: prompt }]);
    console.log(res.choices[0].message.content);
  } catch (err: any) {
    console.error(`❌ All servers and local execution failed.`);
    console.error(`   Last error: ${err.message}`);
    process.exit(1);
  }
}
