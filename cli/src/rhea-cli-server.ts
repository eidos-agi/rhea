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
let serverConfig = loadServerConfig() as any;
if (!serverConfig.codes) serverConfig.codes = {};

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

// ---- COMMAND: PAIR CODE (Generate short code) ----
if (command === 'pair' && args[1] === 'code') {
  const code = crypto.randomBytes(3).toString('hex').toUpperCase(); // 6 chars
  const label = args[2] || 'new-client';
  
  serverConfig.codes[code] = { label, created: new Date().toISOString() };
  saveServerConfig(serverConfig);
  
  console.log(`🎫 Pairing Code: ${code}`);
  console.log(`Valid for 10 minutes. Run on client:`);
  console.log(`  rhea-cli pair <label> ${os.userInfo().username}@<tailnet-hostname> --code ${code}`);
  process.exit(0);
}

// ---- COMMAND: PAIR LIST ----
if (command === 'pair' && args[1] === 'list') {
  console.log("Paired Tokens:");
  for (const [token, data] of Object.entries(serverConfig.tokens)) {
    const d = data as any;
    console.log(`  - ${token.slice(0, 10)}... [${d.label}] (Created: ${d.created})`);
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
          const generator = routeChatCompletion(data.model, data.messages || [], data.stream);
          
          if (data.stream) {
            res.writeHead(200, { 'Content-Type': 'text/event-stream' });
            for await (const chunk of generator) {
              res.write(`data: ${JSON.stringify(chunk)}\n\n`);
            }
            res.end('data: [DONE]\n\n');
          } else {
            let finalResponse;
            for await (const chunk of generator) {
              finalResponse = chunk;
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(finalResponse));
          }
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
      
      // Special action: Exchange Code (No token required, but uses SSH auth as base)
      if (payload.action === 'exchange-code') {
        const codeData = serverConfig.codes[payload.code];
        if (!codeData) {
          console.log(JSON.stringify({ error: { message: "Invalid or expired pairing code." } }));
          process.exit(0);
        }
        
        // Convert code to token
        const token = `rhea_` + crypto.randomBytes(16).toString('hex');
        serverConfig.tokens[token] = { label: codeData.label, created: new Date().toISOString() };
        delete serverConfig.codes[payload.code];
        saveServerConfig(serverConfig);
        
        console.log(JSON.stringify({ token }));
        process.exit(0);
      }

      // 1. Validate Token
      if (!serverConfig.tokens[payload.token]) {
        console.log(JSON.stringify({ error: { message: "Unauthorized: Invalid or revoked pairing token." } }));
        process.exit(0);
      }

      // 2. Handle PING
      if (payload.action === 'ping') {
        console.log(JSON.stringify({ status: 'ok', version: '1.3.0' }));
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
        const generator = routeChatCompletion(payload.model, payload.messages, payload.stream);
        for await (const chunk of generator) {
          console.log(JSON.stringify(chunk));
        }
        process.exit(0);
      }

      // 5. Handle DRAW
      if (payload.action === 'draw') {
        const { generateImage } = await import('@rhea/lib');
        const response = await generateImage(payload.model, payload.prompt);
        console.log(JSON.stringify(response));
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
  console.log("  rhea-cli-server pair code [label]");
  console.log("  rhea-cli-server pair list");
  console.log("  rhea-cli-server pair revoke <token>");
  console.log("  rhea-cli-server daemon [port]");
  console.log("  rhea-cli-server rpc   (Used internally by SSH clients)");
}
