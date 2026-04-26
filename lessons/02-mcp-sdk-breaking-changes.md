# Lesson 2: MCP SDK Breaking Changes

## The Conflict
Initial implementation used `StdnodeTransport` from the `@modelcontextprotocol/sdk`, which was the standard in early 2024 documentation.

## What Failed
The build failed with `Module not found`. Investigation of the `node_modules` structure revealed that the class had been renamed to `StdioServerTransport` and the file moved to `stdio.js`.

## The Lesson
The Model Context Protocol is evolving rapidly. When building MCP servers, never assume the documentation is 100% current. Always inspect the `dist/` or `src/` folders of the SDK in your `node_modules` to verify the actual exported symbols and file paths.
