---
name: rhea
description: Use Rhea when a task benefits from sovereign model routing, a Socratic debate, persistent Rhea sessions, remote server pairing, or Rhea image generation.
---

# Rhea

Rhea is a local MCP-powered sovereign model orchestration suite. It can route prompts through configured local or remote provider CLIs, pair with remote Rhea servers, generate images, and run Dreamer/Doubter/Decider debates.

## When To Use

Use Rhea when the user asks to:

- debate a decision or architecture choice
- ask a question through Rhea's configured provider routing
- use session persistence with Rhea
- pair with a remote Rhea server
- generate an image through Rhea
- compare tradeoffs from multiple viewpoints

## Tools

Prefer the matching MCP tool when available:

- `rhea_debate` for full multi-round analysis
- `ask_rhea` for routed model prompts with optional session persistence
- `rhea_quick` for a fast sanity check
- `rhea_status` to check local configuration
- `rhea_pair` to pair with a remote Rhea server
- `rhea_draw` to generate or edit images

## Local Source

This plugin currently launches Rhea from the local checkout at:

`/Users/dshanklinbv/repos-eidos-agi/rhea`

For a public release, replace the local MCP command with the final package-based launcher for `@rhea/mcp` or the published Rhea command.
