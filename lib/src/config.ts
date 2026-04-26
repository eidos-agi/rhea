import fs from 'fs';
import os from 'os';
import path from 'path';

export const CLIENT_CONFIG_PATH = path.join(os.homedir(), '.rhea-cli.json');
export const SERVER_CONFIG_PATH = path.join(os.homedir(), '.rhea-cli-server.json');

export interface ServerProfile {
  host: string;
  token: string;
}

export interface ClientConfig {
  activeServer: string | null;
  servers: Record<string, ServerProfile>;
  order?: string[]; // Optional server fallback order
}

export interface TokenData {
  label: string;
  created: string;
}

export interface ServerConfig {
  tokens: Record<string, TokenData>;
}

export function loadClientConfig(): ClientConfig {
  if (fs.existsSync(CLIENT_CONFIG_PATH)) {
    try {
      return JSON.parse(fs.readFileSync(CLIENT_CONFIG_PATH, 'utf8'));
    } catch (e) {
      console.error("❌ Error: Failed to parse ~/.rhea-cli.json");
    }
  }
  return { activeServer: null, servers: {} };
}

export function saveClientConfig(config: ClientConfig) {
  fs.writeFileSync(CLIENT_CONFIG_PATH, JSON.stringify(config, null, 2));
}

export function loadServerConfig(): ServerConfig {
  if (fs.existsSync(SERVER_CONFIG_PATH)) {
    try {
      return JSON.parse(fs.readFileSync(SERVER_CONFIG_PATH, 'utf8'));
    } catch (e) {
      console.error("❌ Error: Failed to parse ~/.rhea-cli-server.json");
    }
  }
  return { tokens: {} };
}

export function saveServerConfig(config: ServerConfig) {
  fs.writeFileSync(SERVER_CONFIG_PATH, JSON.stringify(config, null, 2));
}

export function getOrderedServers(config: ClientConfig): (ServerProfile & { name: string })[] {
  const orderedNames: string[] = [];
  
  if (config.activeServer) {
    orderedNames.push(config.activeServer);
  }
  
  if (config.order) {
    for (const name of config.order) {
      if (!orderedNames.includes(name) && config.servers[name]) {
        orderedNames.push(name);
      }
    }
  }
  
  for (const name of Object.keys(config.servers)) {
    if (!orderedNames.includes(name)) {
      orderedNames.push(name);
    }
  }
  
  return orderedNames.map(name => ({ name, ...config.servers[name] }));
}
