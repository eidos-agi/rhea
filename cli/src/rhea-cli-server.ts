#!/usr/bin/env node

import http from 'http';
import crypto from 'crypto';
import os from 'os';
import providers from '../../providers.json' with { type: 'json' };
import { 
  loadServerConfig, 
  saveServerConfig, 
  routeChatCompletion 
} from '@rhea/lib';

const args = process.argv.slice(2);
const command = args[0];

// Load paired tokens
let serverConfig = loadServerConfig();

// ---- COMMAND: PAIR CREATE ----
if (command === 'pair' && args[1] === 'create') {
  const token = `rhea_` + crypto.randomBytes(16).toString('hex');
  const label = args[2] || 'default-client';
  
  serverConfig.tokens[token] = { label, created: new Date().toISOString() };
  saveServerConfig(serverConfig);
  
  console.log(`✅ Pairing token created for '${label}'`);
  console.log(`Run this on your remote client:`);
  console.log(`  rhea-cli pair ${os.userInfo().username}@<tailnet-hostname> --token ${token}`);
  process.exit(0);
}

// ---- COMMAND: PAIR LIST ----
if (command === 'pair' && args[1] === 'list') {
  console.log("Paired Tokens:");
  for (const [token, data] of Object.entries(serverConfig.tokens)) {
    console.log(`  - ${token.slice(0, 10)}... [${data.label}] (Created: ${data.created})`);
  }
  process.exit(0);
}

// ---- COMMAND: PAIR REVOKE ----
if (command === 'pair' && args[1] === 'revoke') {
  const token = args[2];
  if (serverConfig.tokens[token]) {
    delete serverConfig.tokens[token];
    saveServerConfig(serverConfig);
    console.log(`✅ Token ${token} revoked.`);
  } else {
    console.error("❌ Token not found.");
  }
  process.exit(0);
}

// ---- COMMAND: DAEMON ----
if (command === 'daemon') {
  const PORT = parseInt(args[1]) || 8787;
  
  const server = http.createServer(async (req, res) => {
    // 1. Authorization check
    const authHeader = req.headers['authorization'];
    const token = authHeader ? authHeader.replace('Bearer ', '') : null;
    
    if (!token || !serverConfig.tokens[token]) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: { message: "Unauthorized: Invalid rhea token." } }));
      return;
    }

    // 2. Route Chat Completions
    if (req.method === 'POST' && req.url === '/v1/chat/completions') {
      let body = '';
      req.on('data', chunk => body += chunk.toString());
      req.on('end', async () => {
        try {
          const data = JSON.parse(body);
          const responseJson = await routeChatCompletion(data.model, data.messages || []);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(responseJson));
        } catch (err: any) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: { message: err.message } }));
        }
      });
    } else if (req.method === 'GET' && req.url === '/v1/models') {
      const providersObj = providers as Record<string, any>;
      const models = Object.keys(providersObj).map(id => ({ id, object: "model" }));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ object: "list", data: models }));
    } else {
      res.writeHead(404);
      res.end('Not Found');
    }
  });

  server.listen(PORT, '127.0.0.1', () => {
    console.log(`rhea-cli-server daemon listening on http://127.0.0.1:${PORT}`);
    console.log(`Securely reachable via SSH port-forwarding.`);
  });
}

// ---- COMMAND: RPC (STDIO) ----
if (command === 'rpc') {
  let body = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', chunk => { body += chunk; });
  
  process.stdin.on('end', async () => {
    try {
      const payload = JSON.parse(body);
      
      // 1. Validate Token
      if (!serverConfig.tokens[payload.token]) {
        console.log(JSON.stringify({ error: { message: "Unauthorized: Invalid or revoked pairing token." } }));
        process.exit(0); // Exit 0 to pass JSON back cleanly
      }

      // 2. Handle PING
      if (payload.action === 'ping') {
        console.log(JSON.stringify({ status: 'ok', version: '1.1.0' }));
        process.exit(0);
      }

      // 3. Handle LIST
      if (payload.action === 'list') {
        const providersObj = providers as Record<string, any>;
        console.log(JSON.stringify({ models: Object.keys(providersObj) }));
        process.exit(0);
      }

      // 4. Handle ASK
      if (payload.action === 'ask') {
        const responseJson = await routeChatCompletion(payload.model, payload.messages);
        console.log(JSON.stringify(responseJson));
        process.exit(0);
      }
      
    } catch (err: any) {
      console.log(JSON.stringify({ error: { message: err.message } }));
      process.exit(0);
    }
  });
} else if (!['rpc', 'pair', 'daemon'].includes(command)) {
  console.log("Usage:");
  console.log("  rhea-cli-server pair create [label]");
  console.log("  rhea-cli-server pair list");
  console.log("  rhea-cli-server pair revoke <token>");
  console.log("  rhea-cli-server daemon [port]");
  console.log("  rhea-cli-server rpc   (Used internally by SSH clients)");
}
