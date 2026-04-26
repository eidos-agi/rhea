# Rhea: Your AI Subscriptions, Now Your Private APIs

Rhea is a high-performance orchestration suite that turns your existing, subscription-backed AI CLIs (Claude Pro, Gemini Advanced, Codex) into secure, remote, and always-on APIs. 

Instead of paying for metered tokens every time you build a tool or run an agent, Rhea lets you securely "tunnel" into your authenticated local environments from any device, anywhere.

## 💎 Core Value Proposition

- **Zero-Cost APIs**: Stop paying per-token. Rhea utilizes your existing flat-rate subscriptions to provide a robust API layer for your own software.
- **Secure "Compute Tunneling"**: Run heavy or authenticated CLI tools on your powerful hardware (Mac, Cloud VM, Home Server) and query them remotely over an encrypted **Tailscale SSH** connection.
- **Agent Orchestration (MCP)**: Expose your subscriptions as tools to any Model Context Protocol (MCP) client, giving agents direct access to your private model infrastructure.
- **Resilient Reliability**: Define a fallback chain across multiple servers. If your primary node is asleep, Rhea automatically falls back to your secondary nodes or local execution.

---

## 🌟 Key Features

- **Real-time Streaming**: Full token-by-token streaming for instantaneous feedback in the terminal or via SSE.
- **Smart Context Caching**: SHA-256 hashing saves you time and quota by instantly returning results for repeated prompts.
- **Simplified Pairing**: Enroll new clients in seconds using 6-character short codes rather than complex keys.
- **Least-Privilege Security**: Designed to run via forced SSH commands, ensuring remote clients only access the model interface and nothing else.

---

## 📂 Repository Structure

- `lib/`: The shared engine for model routing, configuration, and SSH RPC.
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
rhea-cli ask "Write a long essay on the history of AI"
```

**Managing Server Fallback:**
Set your preferred fallback sequence:
```bash
rhea-cli order primary-vps home-server mac-laptop
```

---

## 🛡️ Security Note
All traffic is encrypted via **Tailscale/WireGuard**. For maximum security, restrict your server's `authorized_keys`:
```text
command="rhea-cli-server rpc",no-pty,no-port-forwarding ssh-ed25519 ...
```

---

## 🛠️ Configuration

Rhea stores configuration in:
- `~/.rhea-cli.json` (Profiles and ordering)
- `~/.rhea-cli-server.json` (Server-side pairing tokens)
- `~/.rhea-cache/` (Local result cache)
