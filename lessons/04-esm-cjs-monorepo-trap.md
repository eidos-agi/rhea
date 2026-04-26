# Lesson 3: The ESM/CJS Monorepo Trap

## The Conflict
The project was initially a mix of CommonJS (`require`) and TypeScript. Converting to a monorepo while maintaining compatibility with modern SDKs (like MCP) required a switch to `type: module` (ESM).

## What Failed
Switching to ESM broke every relative import because TypeScript/NodeNext requires explicit `.js` extensions on imports, even when the source files are `.ts`. Additionally, `require` is unavailable in ESM, breaking local scripts that hadn't been fully refactored.

## The Lesson
When building a modern AI orchestrator, go "Full ESM" from Day 1. Trying to mix CJS and ESM in a monorepo with project references leads to a cascade of configuration errors. Always use `"module": "NodeNext"` and accept that you must use `.js` extensions in your source code.
