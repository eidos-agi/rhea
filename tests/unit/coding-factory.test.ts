import assert from 'node:assert';
import test from 'node:test';
import { Pod } from '../../lib/dist/pod.js';
import { loadClientConfig } from '../../lib/dist/config.js';

test('Coding Factory: End-to-End Orchestration (Mocked)', async () => {
  const config = loadClientConfig();
  const models = ['mock-pod'];
  const pod = new Pod(models, config);
  const requirement = "Create a greeting function";

  console.log("  - Phase 1: Planning...");
  const tasks = await pod.plan(requirement);
  assert.strictEqual(tasks.length, 1);
  assert.strictEqual(tasks[0].id, 'task-1');
  assert.strictEqual(tasks[0].file, 'test.ts');

  console.log("  - Phase 2: Execution...");
  const finalChanges: Record<string, string> = {};
  for (const task of tasks) {
    const result = await pod.debate(task.requirement, { mode: 'code' });
    assert.ok(result.decision.includes('function greet'));
    finalChanges[task.file] = result.decision;
  }

  console.log("  - Phase 3: Refinery...");
  const refineryResult = await pod.refine(requirement, finalChanges);
  assert.strictEqual(refineryResult.status, 'APPROVED');
  
  console.log("✅ Factory integration test passed!");
});
