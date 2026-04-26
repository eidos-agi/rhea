# Rhea Coding Skill

Guidelines for orchestrating automated code generation and cross-model verification using the Rhea Pod architecture.

## Core Philosophy: Verification as Momentum
Single-model code generation often suffers from "invisible bugs"—logical errors that the generating model is blind to because they exist in its own latent "local minima." 

The Rhea Coding flow uses **Language as Momentum** to force a second, independent "mind" to re-verify the logic, breaking the generator's assumptions.

---

## 🛠️ The Coding Pod Flow

When Rhea is tasked with coding, it uses a specialized 3-role rotation:

1.  **The Architect (Dreamer)**: 
    *   **Task**: Implement the solution.
    *   **Discipline**: Produce clean, modular, and typed code. Include inline comments for complex logic.
    *   **Output**: Full implementation and a brief explanation of the architectural choices.

2.  **The Auditor (Doubter)**:
    *   **Task**: Find the breaking point.
    *   **Discipline**: Look for edge cases, security vulnerabilities, performance bottlenecks, and type-safety violations.
    *   **Action**: Provide a structured critique and suggest specific fixes.

3.  **The Integrator (Decider)**:
    *   **Task**: Synthesize and commit.
    *   **Discipline**: Compare the Architect's code with the Auditor's critique. Apply the necessary fixes and produce the final, verified codebase.
    *   **Output**: The final code block, marked as "Verified by Rhea."

---

## 📐 Prompt Scaffolding for Coding

To achieve high-fidelity code, prompts must be **verbose and technical**:

- **Context First**: Define the full project structure and existing dependencies.
- **Strict Types**: Always mandate TypeScript (Strict mode) or the relevant language's strongest type-checking.
- **Fail-Safe Logic**: Instruct the Auditor to assume the code *is already broken* and search for where.

---

## 🚫 Prohibited Practices
- **No "Lazy" Omissions**: Never use `// ... rest of code` or "unchanged logic" placeholders. Rhea always produces complete, copy-pasteable files.
- **No Suppressing Warnings**: Do not use `@ts-ignore`, `any`, or hacky casts unless explicitly requested.
- **No Single-Turn Trust**: Never accept code from a single model if the task is non-trivial. Always route it through the Auditor.
