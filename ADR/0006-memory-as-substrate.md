# ADR 0006: Memory as Substrate

## Status

Accepted.

## Context

The agentic primitives reference frames memory as accumulated experience that should shape thinking before the model decides what to do. Memory is not a tool: if recall is exposed as an optional action, the agent can forget to call it, call it too late, or treat the retrieved text as a verdict.

Rhea already has a single routing choke point: `routeChatCompletion(...)`. Every CLI, OpenAI-compatible provider, daemon request, and RPC ask flows through it before inference. That makes routing the right place to enrich the environment with memory.

## Decision

Rhea builds a bounded, progressively revealed memory substrate before every text model call. The substrate is prepended to the system context, not exposed as a tool.

The first implementation reads a deterministic hierarchy under `~/rhea/memory`:

- `orientation.md`: global have/want/don't-want guidance.
- `projects/<project-slug>.md`: project-specific semantic state.
- `sessions/<session-id>.md`: mid-term task/session state.
- `semantic/*.md`: durable facts and preferences.
- `episodic/*.md`: notable events and prior outcomes.
- `procedural/*.md`: reusable how-to memory.

Progressive reveal is the core constraint:

1. Always reveal the cheapest orientation layer first.
2. Reveal scoped project and session memory next, because those are high-prior and small.
3. Reveal semantic, episodic, and procedural detail only when it scores against the current prompt and recent messages.
4. Cap the final block so memory stays useful instead of becoming context fog.

Later versions can make this multi-pass: reveal indexes first, use them to select detailed shards, then inject only the final chosen substrate before inference. The important invariant stays the same: this happens before thinking, not through a recall tool.

## Consequences

- Agents do not have to remember to remember.
- Tool outputs remain evidence, not authority; the substrate explicitly says current evidence can override stale memory.
- Current user/system instructions still win because memory is context, not a command surface.
- The memory layer can later grow vector search, summarization, and consolidation without changing provider interfaces.

## Escape Hatch

Set `RHEA_MEMORY=0` to disable substrate injection for debugging or clean-room evals.
