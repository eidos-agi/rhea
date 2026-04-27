<p align="center">
  <img src="https://raw.githubusercontent.com/eidos-agi/rhea/master/assets/rhea-banner.png" alt="Rhea AI Banner" width="800">
</p>

# Rhea: Sovereign Model Orchestration

Hi, I'm **Daniel**, an AGI researcher at [Eidos AGI](https://eidosagi.com). For years, we've studied how intelligence emerges not from scaling a single model, but from the mathematical collision of multiple "minds." 

Rhea is the culmination of that research—a high-performance orchestration suite that turns your existing, subscription-backed AI CLIs (Claude Pro, Gemini Advanced, Codex) into secure, remote, and always-on private APIs.

## 💎 The "Zero-Cost" Intelligence Engine

The most powerful models in the world are already on your hardware, hidden behind consumer subscriptions. You're already paying for them. **Rhea lets you govern them as professional infrastructure.**

- **Eliminate Per-Token Costs**: Rhea securely "tunnels" into your authenticated local environments, allowing you to use your flat-rate subscriptions as a robust API layer for your own software, agents, and IDEs.
- **Escape the "Precision Trap"**: Based on our research into [Language as Momentum](https://eidosagi.com/language-as-momentum), Rhea orchestrates multiple models to achieve "structural serendipity"—finding high-fidelity solutions that no single model could reach in isolation.

<p align="center">
  <img src="https://raw.githubusercontent.com/eidos-agi/rhea/master/assets/rhea-savings.png" alt="Rhea Savings Model" width="800">
</p>

---

## 🌟 Orchestration & Intelligence

### The Rhea Pod (Socratic Debate)
Rhea isn't just an orchestrator; it's a momentum engine. It implements our **Pod architecture**: a three-model Socratic debate loop (Dreamer/Doubter/Decider). 

This process forces "discontinuous jumps" in reasoning, breaking the local minima of individual models. Rhea turns the "information bottleneck" of language into a tool for escaping the limits of single-model gradient descent.

#### 🛠️ Specialized Coding Pod
Rhea now includes an expansion for automated software engineering. By using a **Three-Tier Factory Architecture** (Planner / Worker Pods / Refinery), Rhea can decompose complex requirements and cross-verify them to eliminate "invisible bugs."

- **Tier 1: Planner**: Decomposes requirements into small, bounded tasks.
- **Tier 2: Workers**: Ephemeral Pods (Architect/Auditor/Integrator) execute tasks in isolation with **Minimum Viable Context (MVC)**.
- **Tier 3: Refinery**: A semantic Merge Gate that validates the combined results for cross-file consistency.

> [!IMPORTANT]
> **Read the Scaling Research**: Rhea's architecture is based on the [Scaling Laws for Agentic Factories](ARCHITECTURE_SCALING.md). We prioritize simplicity and orchestration over individual agent autonomy to ensure production-grade reliability at scale.

<p align="center">
  <img src="https://raw.githubusercontent.com/eidos-agi/rhea/master/assets/rhea-pod.png" alt="Rhea Pod Orchestration" width="800">
</p>

---

## 🛠️ Infrastructure & Transport

Rhea operates as a split client/server system, optimized for secure private networks.

<p align="center">
  <img src="https://raw.githubusercontent.com/eidos-agi/rhea/master/assets/rhea-topology.png" alt="Rhea Topology" width="800">
</p>

- **Sovereign Server**: Runs on your authenticated hardware (e.g., your personal Mac). It manages model CLIs and exposes a narrow JSON-RPC interface.
- **Remote Client**: Runs anywhere (VPS, Laptop, Mobile). It securely tunnels requests to the server over **Tailscale SSH**.
- **Resilient Fallback**: Define a server order in `~/rhea/client.json`. If your primary node is asleep, Rhea automatically cycles through your mesh or falls back to local execution.

---

## 🚀 Getting Started

Rhea is an **agent-native** suite. We highly encourage using our internal **skills** to automate setup and maintenance.

### 1. Installation
```bash
npm install
npm run build
cd cli && npm link
```

### 2. Fast Onboarding (Recommended)
Use our interactive wizard to link your providers and pair your mesh:
```bash
rhea-cli setup
```

### 3. Usage
```bash
# Ask a question (streams in real-time)
rhea-cli ask "Explain quantum entanglement"

# Run a Socratic Pod debate
rhea-cli debate "How should we regulate AGI development?"

# Orchestrate a Coding Pod (Architect / Auditor / Integrator)
rhea-cli code "Write a TypeScript class to manage a LRU cache with SHA-256 keys"

# Generate high-fidelity images (Nano Banana 3)
rhea-cli draw "A minimalist representation of momentum" --output logo.png --aspect-ratio 16:9
```
### 4. Leverage Skills
Rhea includes specialized agent instructions in the `.skills` directory. Use these skills to guide your AI assistants during deployment:
- **`rhea-doctor`**: Automated health diagnostics and orchestration repair.
- **`rhea-client-install`**: Automated client setup.
- **`rhea-server-install`**: Automated server setup and hardening.
- **`rhea-pairing`**: Troubleshooting and managing secure server identities.

---

## 🐍 Python Client

Rhea is now available as a Python package for integration into your own Python-based agents and workflows.

```bash
pip install rhea-ai
```

```python
from rhea import RheaClient
client = RheaClient()
response = client.ask("claude-pro", "Analyze this codebase.")
```

---

## 🛡️ Security & Privacy
...
All traffic is encrypted via **Tailscale/WireGuard**. Rhea is designed for **Least Privilege**, running via narrow RPC commands rather than a broad shell.

---

## 📜 License
Rhea is licensed under **Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0)**.
*Attribution to Eidos AGI and Daniel is required. Commercial resale is strictly prohibited.*

---

## 🔬 Read the Research
If you want to understand the math behind why Rhea works, read our full study:
[**Language as Momentum: Escaping the Precision Trap**](https://eidosagi.com/language-as-momentum)
