# Rhea Doctor Skill

A guide for diagnosing and maintaining the health of a Rhea orchestration environment.

## Overview
The Rhea Doctor skill is used to ensure the "Factory Floor" is fully functional. It validates that all underlying model providers (SOTA CLIs and APIs) are authenticated, reachable, and providing accurate responses.

## Diagnostics
Always start by running the ground-truth diagnostic command:
```bash
rhea-cli doctor
```

### Phase 1: Binary Dependencies
- **Issue**: `NOT FOUND` for `claude` or `gemini`.
- **Fix**: Install the missing CLI tool. 
  - For Claude: `npm install -g @anthropic-ai/claude-code`
  - For Gemini: `npm install -g @google/gemini-cli`

### Phase 2: Secret Keystore
- **Issue**: API keys like `OPENROUTER_API_KEY` are `Not set`.
- **Fix**: Use Rhea's internal keystore to save the key.
  ```bash
  rhea-cli key set <KEY_NAME> <VALUE>
  ```

### Phase 3: Live Model Probes
This phase performs a "Truth Check" (e.g., Capital of Canada).
- **Issue**: `❌ FAILED` or `⚠️ UNEXPECTED`.
- **Potential Causes**:
  1. **Expired Session**: The model CLI requires re-authentication (e.g., run `claude login`).
  2. **Broken Mapping**: Check `providers.json` to ensure the `cmd` pattern is correct (e.g., ensuring `gemini` uses `["gemini", "-p", "-"]` for stdin).
  3. **Network/API Issues**: Verify connectivity to OpenRouter or OpenAI if using API providers.

### Phase 4: Remote Mesh Reachability
- **Issue**: Server is `Offline`.
- **Fix**: 
  1. Verify the remote host is reachable via `ssh <host>`.
  2. Ensure `rhea-cli-server daemon` is running on the remote node.
  3. Check Tailscale status if using a private mesh.

## Verification
After applying any fix, always verify the result by rerunning `rhea-cli doctor`. A healthy Rhea environment should show `✅ WORKING` for all core SOTA models.
