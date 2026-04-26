<p align="center">
  <img src="https://raw.githubusercontent.com/eidos-agi/rhea/master/assets/rhea-banner.png" alt="Rhea AI Banner" width="800">
</p>

# Rhea: Your AI Subscriptions, Now Your Private APIs

Hi, I'm **Daniel**, an AGI researcher at [Eidos AGI](https://eidosagi.com). For years, we've studied how intelligence emerges not from scaling a single model, but from the mathematical collision of multiple "minds." 

Rhea is the culmination of that research—a high-performance orchestration suite that turns your existing, subscription-backed AI CLIs (Claude Pro, Gemini Advanced, Codex) into secure, remote, and always-on APIs.

<p align="center">
  <img src="https://raw.githubusercontent.com/eidos-agi/rhea/master/assets/rhea-savings.png" alt="Rhea Savings Model" width="800">
</p>

## 💎 The "Zero-Cost" Intelligence Engine

The most powerful models in the world are already on your machine, hidden behind "consumer" subscriptions. You're already paying for them. **Rhea lets you use them to their maximum potential.**

- **Stop Paying Per-Token**: Rhea securely "tunnels" into your authenticated local environments, allowing you to use your flat-rate subscriptions as a robust API layer for your own software, agents, and IDEs.
- **Escape the "Precision Trap"**: Based on our research into [Language as Momentum](https://eidosagi.com/language-as-momentum), Rhea orchestrates multiple models to achieve "structural serendipity"—finding high-fidelity solutions that no single model could reach in isolation.

---

## 🌟 Orchestration & Intelligence

### The Rhea Pod (Socratic Debate)
Rhea isn't just an orchestrator; it's a momentum engine. It implements our **Pod architecture**: a three-model Socratic debate loop (Dreamer/Doubter/Decider). 

This process forces "discontinuous jumps" in reasoning, breaking the local minima of individual models. Rhea turns the "information bottleneck" of language into a tool for escaping the limits of single-model gradient descent.

<p align="center">
  <img src="https://raw.githubusercontent.com/eidos-agi/rhea/master/assets/rhea-pod.png" alt="Rhea Pod Orchestration" width="800">
</p>

- **Dreamer**: Performs a "lossy projection" of the problem, expanding the solution space.
- **Doubter**: Adversarially critiques assumptions to find the "deepest flaw."
- **Decider**: Weighs the collision and commits to a final, high-confidence decision.

---

## 🛠️ Infrastructure & Transport

Rhea operates as a split client/server system, optimized for secure private networks.

<p align="center">
  <img src="https://raw.githubusercontent.com/eidos-agi/rhea/master/assets/rhea-topology.png" alt="Rhea Topology" width="800">
</p>

- **Rhea Server**: Runs on your authenticated hardware (e.g., your personal Mac). It manages model CLIs and exposes a narrow JSON-RPC interface.
- **Rhea Client**: Runs anywhere (VPS, Laptop, Mobile). It securely tunnels requests to the server over **Tailscale SSH**.
- **Resilient Fallback**: Define a server order in `~/rhea/client.json`. If your primary node is asleep, Rhea automatically cycles through your mesh or falls back to local execution.

---

## 🚀 Getting Started

### 1. Installation
```bash
npm install
npm run build
cd cli && npm link
```

### 2. Fast Onboarding
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

# Generate high-fidelity images (Nano Banana 3)
rhea-cli draw "A minimalist representation of momentum" --output logo.png --aspect-ratio 16:9
```

---

## 🛡️ Security & Privacy
All traffic is encrypted via **Tailscale/WireGuard**. Rhea is designed for **Least Privilege**, running via narrow RPC commands rather than a broad shell.

---

## 📜 License
Rhea is licensed under **Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0)**.
*Attribution to Eidos AGI and Daniel is required. Commercial resale is strictly prohibited.*

---

## 🔬 Read the Research
If you want to understand the math behind why Rhea works, read our full study:
[**Language as Momentum: Escaping the Precision Trap**](https://eidosagi.com/language-as-momentum)
