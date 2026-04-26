# Rhea Test Suite

This directory contains test fixtures and unit/integration tests for the Rhea AI orchestrator.

## 📂 Structure

- `fixtures/`: Static data used for testing (configs, prompts, sample responses).
- `unit/`: Core logic tests for routing, caching, and pod orchestration.
- `integration/`: End-to-end tests for SSH RPC and multi-model flows.

## 🚀 Running Tests

Rhea uses the native Node.js test runner. To run all tests:

```bash
npm test
```

To run a specific test file:

```bash
node --test tests/unit/fixtures.test.ts
```

## 🛠️ Adding Fixtures

When adding new features (e.g., new model providers or specialized pods), please add a corresponding fixture in `tests/fixtures/` to ensure regression testing is possible without live API calls.
