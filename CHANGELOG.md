# Changelog

All notable changes to this project will be documented in this file.

## [1.4.0] - 2026-04-26
### Added
- **Rhea Images Library**: Extracted image generation into a dedicated `@rhea/images` package.
- **Advanced Draw Flags**: Added support for `--aspect-ratio` and `--size` in `rhea-cli draw`.
- **Iterative Image Editing**: Improved multi-turn support for Nano Banana (Gemini 3.1 Flash Image).

## [1.3.0] - 2026-04-26
### Changed
- **Config Storage**: Unified all persistent state into a single `~/rhea/` directory.
- **Project Infrastructure**: Adopted `foss-forge` standards for community health.
### Added
- **Community Health**: Added `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, and `SECURITY.md`.

## [1.2.0] - 2026-04-26
### Added
- **Multi-modal Support**: Integrated image generation using the **Nano Banana** model series (Gemini 3.1 Flash Image).
- **`rhea-cli draw`**: New CLI command for generating and editing images with real-time feedback.
- **`rhea_draw`**: New MCP tool for image generation.
- **`.skills` Folder**: Added specialized agent instructions for orchestration, pairing, and installation.

## [1.1.0] - 2026-04-26
### Added
- **Intelligence Orchestration**: Merged the **Rhea Pod** architecture (Socratic Debate).
- **`rhea_debate`**: New MCP tool for multi-model reasoning.
- **Dynamic Discovery**: The MCP server now dynamically discovers models from `providers.json`.
- **Model Recycling**: The Pod engine now recycles available models if fewer than 3 subscriptions are active.

## [1.0.0] - 2026-04-26
### Added
- **TypeScript Migration**: Converted the entire codebase to strict TypeScript with ESM support.
- **Monorepo Restructuring**: Organized into `cli`, `lib`, and `mcp` workspaces.
- **Real-time Streaming**: Implemented token-by-token streaming over SSH RPC and SSE.
- **Smart Context Caching**: Added SHA-256 based prompt caching in `~/.rhea-cache`.
- **Multi-turn Sessions**: Added persistent conversation history with `--session <id>`.
- **Short Code Pairing**: Improved enrollment UX with 6-character pairing codes.
- **Server Ordering**: Implemented resilient fallback chains across multiple server profiles.
