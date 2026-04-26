# Rhea Orchestrator Skill

A guide for maintaining and extending the Rhea AI Model Routing Suite.

## Architecture Overview
Rhea is a TypeScript monorepo with three primary workspaces:
- `lib/`: Shared logic for model routing, configuration management, session persistence, and SSH RPC.
- `cli/`: Binary tools (`rhea-cli`, `rhea-cli-server`).
- `mcp/`: Model Context Protocol server exposing Rhea as a toolset for agents.

## Core Mandates
1. **Subscriptions as APIs**: Always prefer CLI-backed providers (Claude Code, Gemini CLI) to utilize flat-rate subscriptions instead of metered tokens.
2. **Resilience First**: Use the `getOrderedServers` fallback logic for all prompt executions to ensure high availability across the server mesh.
3. **Least Privilege**: Maintain the Stdio RPC pattern over Tailscale SSH. No broad shell access should be required for remote clients.
4. **Pure TypeScript**: Maintain a 100% TS codebase in `src/` folders with compiled `dist/` targets.

## Extension Patterns
- **Adding a Provider**: Update `providers.json` and `lib/src/router.ts`.
- **Adding an MCP Tool**: Update `mcp/src/index.ts` and ensure it uses the shared fallback logic in `lib/src/pod.ts`.
- **Modifying RPC**: Update `lib/src/rpc.ts` (client) and `cli/src/rhea-cli-server.ts` (server).

## Multi-turn Context
- Use `lib/src/session.ts` for message persistence.
- Always pass `sessionId` down to the Gemini CLI for image editing consistency.
