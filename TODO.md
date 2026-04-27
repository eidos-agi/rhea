# Rhea: Cardiovascular Evolution Roadmap

This document outlines the strategic priorities for evolving Rhea from a high-precision factory into a living, organic orchestration system.

## 🫀 1. The "Rhea Heart" (WorkflowEngine)
Extract the orchestration logic from the CLI/MCP into a centralized `lib/src/engine.ts`.
- **Capillary Flow**: Enforce strict Minimum Viable Context (MVC) so tasks are small enough to flow through any model without blockage (drift).
- **Non-deterministic Idempotence**: Ensure the outcome is guaranteed even if the path (retries, model swaps) varies.
- **Organic State**: Treat the plan as a living molecule that persists to disk and survives system interruptions.

## 🗣️ 2. Surface the "Collision Logic"
Move Rhea from a "Black Box" to a "Collaborative Reasoning Partner."
- **Narrative Deciding**: Instead of just raw output, the Integrator should explain the synthesis: *"The Architect proposed X, but the Auditor caught Y, so I implemented Z."*
- **Debate Visibility**: Make the adversarial clashes that lead to truth a first-class citizen in the UI/CLI.

## 🔄 3. Dynamic Socratic Momentum
Break the rigid dreamer -> doubter -> decider rotation.
- **Corrective Loops**: Empower the `Decider` to send the `Dreamer` back for revisions with specific feedback from the `Doubter`, creating a real conversation.
- **Adaptive Precision**: Allow the Pod to increase its "clock speed" (more rounds) for high-ambiguity tasks and bypass debate for "Direct Ask" tasks.

## 🩺 4. Self-Healing Diagnostics
Upgrade the `doctor` command to be proactive.
- **Automated Repair**: If a secret is missing, prompt to set it. If a session is expired, trigger the login flow.
- **Environment Parity**: Ensure the remote mesh nodes report their health back to the central client.

## 🌊 5. Cardiovascular Task Decomposition
Refine the `Planner` to break work into the smallest possible units of intent.
- **Blockage Prevention**: Ensure no task is large enough to trigger the "Lost in the Middle" phenomenon or context pollution.
- **Intent Persistence**: Maintain a strong "cardiovascular pressure" of intent throughout the entire task chain.

---
*"Truth through collision, orchestration through flow."*
