# Rhea: The Scaling Laws of Agentic Factories

Rhea is built on the belief that **multi-agent systems are not teams; they are factories.** 

Traditional agent frameworks often fail at scale because they mimic human team dynamics—shared context, continuous operation, and peer-to-peer coordination. Research (Google/MIT, 2025) and production experience (Cursor, Gas Town) prove that these metaphors create **serial dependencies** that block the conversion of compute into capability.

## 🏭 The Rhea "Factory" Architecture

Rhea implements a **Three-Tier Centralized Orchestration** model to eliminate coordination overhead and error amplification.

### Tier 1: The Planner (Task Decomposition)
Complexity belongs in the orchestration layer, not the workers. When a high-level requirement is received, a dedicated **Planner** model decomposes it into a sequence of small, bounded, and independent tasks.
- **Goal**: Minimize "Capability Saturation" by keeping worker objectives narrow.
- **Output**: A JSON roadmap of discrete file-level operations.

### Tier 2: Worker Pods (Isolated Execution)
Workers operate in **Minimum Viable Context (MVC)**. They are deliberately kept "ignorant" of the broader project to prevent scope creep and drift.
- **Isolation**: Each worker (a Rhea Pod) receives only the specific requirement and the exact files identified by the Planner.
- **Precision**: By reducing tool count and context noise, we maximize selection accuracy and implementation fidelity.
- **Episodic**: Workers execute a single task and terminate. No long-running state pollution.

### Tier 3: The Refinery (Merge Gate)
Since workers do not coordinate with each other, they cannot resolve cross-file conflicts. This complexity is moved to the **Refinery**.
- **Validation**: A final high-capability pass reviews the aggregate diff of all workers.
- **Semantic Consistency**: The Refinery checks for type mismatches, broken references, and logic gaps before any changes are finalized.
- **Approval**: No code is written unless the Refinery confirms the fulfillment of the original requirement.

---

## 📐 Core Engineering Principles

### 1. Simplicity Scales
Complexity in agents works for 3 agents but fails for 300. Rhea keeps agents "dumb" and specialized so that scaling becomes a matter of adding parallel workers rather than managing human-like coordination.

### 2. Information Hiding (MVC)
Giving an agent more context than it needs is a cost, not a feature. We enforce MVC to ensure workers cannot make unauthorized refactors or re-interpret global goals.

### 3. Workflow State Over Context
Intent is sustained through an external **Task Queue**, not through long-running conversation history. This allows Rhea to survive crashes, restarts, and model "lost-in-the-middle" degradation.

### 4. Designing for Endings
We do not fight context limits; we embrace them. By designing tasks to be ephemeral and episodic, we ensure that every worker starts with a clean, high-signal context.

---

## 🔬 Scientific Foundation
Rhea's architecture is a direct response to the **2025 Google & MIT study** on agent scaling and the **Language as Momentum** research into escaping the precision trap of single-model reasoning.

*"10,000 dumb agents, well-coordinated, will always outproduce one brilliant agent lost in its own context."*
