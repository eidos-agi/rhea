# Rhea: Your AI Subscriptions, Now Your Private APIs

Rhea is a high-performance orchestration suite that turns your existing, subscription-backed AI CLIs (Claude Pro, Gemini Advanced, Codex) and standard AI APIs (OpenAI, Stability, FAL.ai) into secure, remote, and always-on endpoints.

Instead of paying for metered tokens every time you build a tool or run an agent, Rhea lets you securely "tunnel" into your authenticated local environments and subscriptions from any device, anywhere.

## 💎 Core Value Proposition

- **Zero-Cost APIs**: Stop paying per-token. Rhea utilizes your existing flat-rate subscriptions to provide a robust API layer for your own software.
- **Secure "Compute Tunneling"**: Run heavy or authenticated CLI tools on your powerful hardware (Mac, Cloud VM, Home Server) and query them remotely over an encrypted **Tailscale SSH** connection.
- **Multi-Provider Image Support**: Use **DALL-E 3**, **Stable Diffusion 3**, or **Flux 2** alongside **Nano Banana 2** (Gemini Image) through a unified interface.
- **Agent Orchestration (MCP)**: Expose your subscriptions as tools to any Model Context Protocol (MCP) client, giving agents direct access to your private model infrastructure.
- **Resilient Reliability**: Define a fallback chain across multiple servers. If your primary node is asleep, Rhea automatically falls back to your secondary nodes or local execution.

---

## 🌟 Key Features

- **Intelligence Pods (Socratic Debate)**: Orchestrate high-fidelity reasoning using the Rhea Pod engine. Run three-model debates (Dreamer/Doubter/Decider) to solve complex problems with built-in skepticism and commitment logic.
- **Multi-modal Support**: Generate and iteratively edit images using the Gemini 3.1 Flash Image model series or cloud APIs.
- **Real-time Streaming**: Full token-by-token streaming for instantaneous feedback in the terminal or via SSE.
- **Smart Context Caching**: SHA-256 hashing saves you time and quota by instantly returning results for repeated prompts.
- **Simplified Pairing**: Enroll new clients in seconds using 6-character short codes rather than complex keys.

---

## 📂 Repository Structure

- `lib/`: The shared engine for model routing, configuration, and session persistence.
- `images/`: Dedicated high-performance image generation engine supporting multiple providers.
- `cli/`: The `rhea-cli` client and `rhea-cli-server` daemon.
- `mcp/`: The `rhea-mcp` server for MCP-compatible clients and agents.

---

## 🚀 Getting Started

### 1. Installation

Build the suite from source:
```bash
npm install
npm run build
```

Link the binaries for global use:
```bash
cd cli
npm link
```

### 2. Server Setup (e.g., on your Mac or Cloud VM)

Ensure you are authenticated in your chosen model CLIs (e.g., `claude login`), then generate a pairing code:
```bash
rhea-cli-server pair code "My-VPS"
# 🎫 Pairing Code: B3F2A1
```

### 3. Client Pairing

Pair your remote client using the generated code:
```bash
rhea-cli pair my-mac user@mac-host --code B3F2A1
```

### 4. Usage

**Ask a question (streams in real-time):**
```bash
rhea-cli ask "Explain quantum entanglement"
```

**Generate an image (Nano Banana):**
```bash
rhea-cli draw "A cyberpunk city" --output city.png --aspect-ratio 16:9 --size 2k
```

**Use a Cloud Image API:**
```bash
# OpenAI DALL-E 3
rhea-cli draw --model dalle-3 "A majestic Rhea bird" --output bird.png

# Stability AI SD3
rhea-cli draw --model sd3 "A hyper-realistic landscape" --output forest.png --aspect-ratio 16:9
```

---

## 🛡️ Security Note
All traffic is encrypted via **Tailscale/WireGuard**. For maximum security, restrict your server's `authorized_keys`:
```text
command="rhea-cli-server rpc",no-pty,no-port-forwarding ssh-ed25519 ...
```

---

## 📜 License

Rhea is licensed under **Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0)**.

- **Attribution**: You must give appropriate credit to Eidos AGI.
- **Non-Commercial**: You may not use this software for commercial purposes.
- **No Resale**: You specifically may not re-sell this software or any derivatives of it.

For commercial inquiries, please contact Eidos AGI.

---

## 🛠️ Configuration

Rhea stores all persistent state in your home directory at `~/rhea/`:
- `~/rhea/client.json`: Remote server profiles and fallback ordering.
- `~/rhea/server.json`: Server-side pairing tokens and authorized clients.
- `~/rhea/cache/`: Local context cache (SHA-256 hashed).
- `~/rhea/sessions/`: Persistent multi-turn conversation history.
