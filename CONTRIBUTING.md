# Contributing to Rhea

Thanks for your interest in contributing to Rhea.

## Quick start

```bash
git clone https://github.com/eidos-agi/rhea.git
cd rhea
npm install
npm run build
```

## Development

We use TypeScript and modern ES Modules.

Run the build:
```bash
npm run build
```

Run in watch mode:
```bash
npm run dev
```

## For agent developers

Rhea is built for AI tools that AI agents use. If you're extending Rhea (e.g., adding MCP tools or new model orchestration patterns), pay special attention to:

1. **Tool descriptions** — Every MCP tool must have a description that explains *when* to use it, not just *what* it does. An agent choosing between 20 tools needs clear differentiation.
2. **Parameter descriptions** — Every parameter needs a `description` field. Agents don't have UI tooltips — the description is all they get.
3. **Error messages** — When something fails, the error message must tell the agent what to do next. Actionable errors reduce agent loops.
4. **Typed everything** — Strictly type all public functions and interfaces. Agents parse types to understand contracts.

## Pull requests

- Keep PRs focused — one feature or fix per PR
- Include tests for new functionality (where applicable)
- Update CHANGELOG.md with your changes
- Ensure `npm run build` passes

## Reporting issues

Open an issue with:

1. What you were trying to do
2. What happened instead
3. Steps to reproduce
