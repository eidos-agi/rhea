# Example 01: The Socratic Coding Factory

This example demonstrates Rhea's high-precision **"Factory"** architecture in action.

## The Problem
Implementing a **Persistent LRU Cache with TTL** is a classic "Precision Trap." It seems simple, but it requires coordinating three distinct domains:
1.  **Memory Management**: Least Recently Used eviction logic.
2.  **Temporal Logic**: Time-to-Live expiration and cleanup.
3.  **Persistence**: Atomic file-system writes and state restoration.

A single AI agent often misses the semantic links between these layers (e.g., forgetting to restore the TTL timestamps during persistence loading).

## The Rhea Solution
Rhea solves this using a **Three-Tier Socratic Factory**:

### Tier 1: The Planning Pod
A council of 3 models (Architect, Auditor, Integrator) analyzes the `requirement.txt` and produces a structured JSON roadmap. It identifies that we need `types.ts`, `storage.ts`, and `cache.ts`, ensuring that the dependency graph between them is correct before any code is written.

### Tier 2: The Worker Pods
Each file is implemented by a dedicated Pod. 
- The `lru.ts` Pod debates the best way to handle TTL without creating memory leaks.
- The `storage.ts` Pod is adversarially audited to handle edge cases like corrupted JSON or locked files.

### Tier 3: The Refinery Pod
The final council reviews the aggregate diff. It ensures that the `Storage` class correctly uses the interfaces defined in `types.ts` and that the `Cache` correctly initializes the storage layer.

## How to Run
To see Rhea orchestrate this implementation, run:

```bash
rhea-cli code "$(cat examples/01-socratic-factory-cache/requirement.txt)"
```

## Why this is "Interesting"
Unlike a standard chat-based agent, Rhea:
- **Never "guesses" the architecture**: It debates it first.
- **Enforces Minimum Viable Context**: The `storage.ts` worker doesn't get distracted by the LRU logic; it only sees the types it needs to implement its narrow task.
- **Validates the Assembly**: The Refinery pass catches semantic mismatches that single agents usually leave for the human to find during compilation.
