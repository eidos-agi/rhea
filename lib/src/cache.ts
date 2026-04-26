import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';

import { RHEA_DIR } from './config.js';

const CACHE_DIR = path.join(RHEA_DIR, 'cache');

export function getCacheKey(model: string, messages: any[]): string {
  const hash = crypto.createHash('sha256');
  hash.update(model);
  hash.update(JSON.stringify(messages));
  return hash.digest('hex');
}

export function getCachedResponse(key: string): any | null {
  const filePath = path.join(CACHE_DIR, `${key}.json`);
  if (fs.existsSync(filePath)) {
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (e) {
      return null;
    }
  }
  return null;
}

export function saveToCache(key: string, data: any) {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
  const filePath = path.join(CACHE_DIR, `${key}.json`);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

export function clearCache() {
  if (fs.existsSync(CACHE_DIR)) {
    fs.rmSync(CACHE_DIR, { recursive: true, force: true });
  }
}
