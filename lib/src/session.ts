import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { Message } from './router.js';

import { RHEA_DIR } from './config.js';

const SESSIONS_DIR = path.join(RHEA_DIR, 'sessions');

export function generateSessionId(): string {
  return crypto.randomBytes(4).toString('hex').toUpperCase(); // 8 chars
}

export function saveSession(sessionId: string, messages: Message[]) {
  if (!fs.existsSync(SESSIONS_DIR)) {
    fs.mkdirSync(SESSIONS_DIR, { recursive: true });
  }
  const filePath = path.join(SESSIONS_DIR, `${sessionId}.json`);
  fs.writeFileSync(filePath, JSON.stringify({ sessionId, messages, updated: new Date().toISOString() }, null, 2));
}

export function loadSession(sessionId: string): Message[] {
  const filePath = path.join(SESSIONS_DIR, `${sessionId}.json`);
  if (fs.existsSync(filePath)) {
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      return data.messages || [];
    } catch (e) {
      return [];
    }
  }
  return [];
}

export function listSessions(): string[] {
  if (!fs.existsSync(SESSIONS_DIR)) return [];
  return fs.readdirSync(SESSIONS_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => f.replace('.json', ''));
}
