import assert from 'node:assert';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { buildMemorySubstrate, mergeSystemWithMemory } from '../../lib/dist/memory.js';

test('Memory substrate is injected before thinking and can be disabled', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'rhea-memory-'));
  const originalMemoryDir = process.env.RHEA_MEMORY_DIR;
  const originalMemory = process.env.RHEA_MEMORY;
  process.env.RHEA_MEMORY_DIR = path.join(home, 'memory');
  delete process.env.RHEA_MEMORY;

  try {
    const memoryDir = process.env.RHEA_MEMORY_DIR as string;
    fs.mkdirSync(memoryDir, { recursive: true });
    fs.writeFileSync(
      path.join(memoryDir, 'orientation.md'),
      'What it does not want: never treat stale memory as a verdict.'
    );

    const substrate = buildMemorySubstrate({
      messages: [{ role: 'user', content: 'Plan the eval harness.' }],
      cwd: '/tmp/eval-harness',
      maxChars: 1000,
    });

    assert.match(substrate.content, /MEMORY SUBSTRATE/);
    assert.match(substrate.content, /stale memory as a verdict/);

    const merged = mergeSystemWithMemory('Current instruction wins.', substrate);
    assert.ok(merged?.startsWith('MEMORY SUBSTRATE'));
    assert.match(merged || '', /Current instruction wins/);

    process.env.RHEA_MEMORY = '0';
    assert.strictEqual(
      buildMemorySubstrate({
        messages: [{ role: 'user', content: 'Plan the eval harness.' }],
        cwd: '/tmp/eval-harness',
      }).content,
      ''
    );
  } finally {
    if (originalMemoryDir === undefined) delete process.env.RHEA_MEMORY_DIR;
    else process.env.RHEA_MEMORY_DIR = originalMemoryDir;
    if (originalMemory === undefined) delete process.env.RHEA_MEMORY;
    else process.env.RHEA_MEMORY = originalMemory;
    fs.rmSync(home, { recursive: true, force: true });
  }
});
