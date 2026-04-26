import fs from 'fs';
import os from 'os';
import path from 'path';

export const RHEA_DIR = path.join(os.homedir(), 'rhea');
export const CLIENT_CONFIG_PATH = path.join(RHEA_DIR, 'client.json');
export const SERVER_CONFIG_PATH = path.join(RHEA_DIR, 'server.json');
export const KEYS_CONFIG_PATH = path.join(RHEA_DIR, 'keys.json');

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

export type KeysConfig = Record<string, string>;

/**
 * Ensures RHEA_DIR exists and has correct permissions
 */
function ensureRheaDir() {
  if (!fs.existsSync(RHEA_DIR)) {
    fs.mkdirSync(RHEA_DIR, { recursive: true });
    fs.chmodSync(RHEA_DIR, 0o700);
  }
}

export function loadClientConfig(): ClientConfig {
  ensureRheaDir();
  if (fs.existsSync(CLIENT_CONFIG_PATH)) {
    try {
      return JSON.parse(fs.readFileSync(CLIENT_CONFIG_PATH, 'utf8'));
    } catch (e) {
      console.error(`❌ Error: Failed to parse ${CLIENT_CONFIG_PATH}`);
    }
  }
  return { activeServer: null, servers: {} };
}

export function saveClientConfig(config: ClientConfig) {
  ensureRheaDir();
  fs.writeFileSync(CLIENT_CONFIG_PATH, JSON.stringify(config, null, 2));
}

export function loadServerConfig(): ServerConfig {
  ensureRheaDir();
  if (fs.existsSync(SERVER_CONFIG_PATH)) {
    try {
      return JSON.parse(fs.readFileSync(SERVER_CONFIG_PATH, 'utf8'));
    } catch (e) {
      console.error(`❌ Error: Failed to parse ${SERVER_CONFIG_PATH}`);
    }
  }
  return { tokens: {} };
}

export function saveServerConfig(config: ServerConfig) {
  ensureRheaDir();
  fs.writeFileSync(SERVER_CONFIG_PATH, JSON.stringify(config, null, 2));
}

export function loadKeys(): KeysConfig {
  ensureRheaDir();
  if (fs.existsSync(KEYS_CONFIG_PATH)) {
    try {
      return JSON.parse(fs.readFileSync(KEYS_CONFIG_PATH, 'utf8'));
    } catch (e) {
      console.error(`❌ Error: Failed to parse ${KEYS_CONFIG_PATH}`);
    }
  }
  return {};
}

export function saveKeys(keys: KeysConfig) {
  ensureRheaDir();
  fs.writeFileSync(KEYS_CONFIG_PATH, JSON.stringify(keys, null, 2));
  fs.chmodSync(KEYS_CONFIG_PATH, 0o600); // Strict permissions for secrets
}

/**
 * Injects keys from the keystore into process.env
 */
export function injectEnvKeys() {
  const keys = loadKeys();
  for (const [name, value] of Object.entries(keys)) {
    process.env[name] = value;
  }
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
