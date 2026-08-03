# RETIRED — rhea

**Status:** Retired / sunset  
**Date:** 2026-08-03 (UTC)  
**Host:** daniel-laptop-01

## Why

Removed from the global Codex MCP surface on Daniel's laptop and retired from
host ASMP discovery. This repository is no longer an active product surface.

## What was done

- Codex MCP: disabled via `codex-mcp-manager` (`enabled = false`)
- ASMP (this machine): confirmed not registered / do not re-register
- GitHub: description prefixed `[RETIRED]`, repository archived after this commit
- Tracking: GitHub issue card for this retirement (see issue linked in commit/PR notes)

## Do not

- Do not re-enable the global Codex MCP without a new human `decide keep`
- Do not re-register an ASMP manifest on daniel-laptop-01 without review

## Operator

Grok plugin `codex-mcp-manager` on the AIC software engineer cockpit.
