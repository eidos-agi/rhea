import assert from 'node:assert';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test('Fixtures: Configuration loading', () => {
  const configPath = path.join(__dirname, '../fixtures/configs/sample-client.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  
  assert.strictEqual(config.activeServer, 'primary-vps');
  assert.strictEqual(Object.keys(config.servers).length, 2);
  assert.deepStrictEqual(config.order, ['primary-vps', 'home-server']);
});

test('Fixtures: Prompt loading', () => {
  const promptPath = path.join(__dirname, '../fixtures/prompts/quantum.txt');
  const prompt = fs.readFileSync(promptPath, 'utf8');
  
  assert.ok(prompt.includes('Language as Momentum'));
  assert.ok(prompt.includes('lossy projection'));
});

test('Fixtures: Pod result validation', () => {
  const resultPath = path.join(__dirname, '../fixtures/responses/sample-code-pod.json');
  const result = JSON.parse(fs.readFileSync(resultPath, 'utf8'));
  
  assert.strictEqual(result.status, 'decision');
  assert.strictEqual(result.rounds.length, 1);
  assert.ok(result.decision.includes('function fibonacci'));
});
