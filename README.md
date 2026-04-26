# Rhea: Secure Remote AI Model Router

Rhea is a comprehensive suite for multiplexing AI model execution across subscription-backed CLIs (Claude, Gemini) and Cloud APIs (OpenRouter, NIM). It uses **Tailscale SSH** and **Model Context Protocol (MCP)** to provide secure, always-on access to your favorite models from any device.

## 🌟 Key Features

- **Split Architecture**: Run heavy CLI tools on a central machine (e.g., a Mac or Cloud VM) and access them remotely via lightweight clients.
- **Tailscale SSH Integration**: Secure, private transport between clients and servers without complex key management.
- **MCP Server**: Integrated Model Context Protocol server exposing Rhea tools to intelligent agents and IDEs.
- **Server Ordering & Fallback**: Configure a prioritized list of servers; Rhea will automatically fall back to the next available server (or local execution) if a primary server is offline.
- **OpenAI-Compatible Facade**: Exposes a local OpenAI-compatible API for seamless integration with existing tools.

## 📂 Repository Structure

- `lib/`: Shared logic for configuration management, SSH RPC, and model routing.
- `cli/`: The `rhea-cli` client and `rhea-cli-server` daemon.
- `mcp/`: The `rhea-mcp` server for MCP-compatible clients.

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

### 2. Server Setup (e.g., on your Mac)

Create a pairing token for your clients:
```bash
rhea-cli-server pair create "My-VPS"
# ✅ Pairing token created!
# Run: rhea-cli pair my-mac user@mac-host --token rhea_...
```

### 3. Client Pairing

Pair your remote client to the server:
```bash
rhea-cli pair my-mac user@mac-host --token rhea_...
```

Verify the connection:
```bash
rhea-cli status
# Server:      my-mac
# Reachability: Online
```

### 4. Usage

**Ask a question:**
```bash
rhea-cli ask "Explain quantum entanglement"
```

**List available models:**
```bash
rhea-cli list
```

**Managing Server Identities:**
List all paired servers and see which one is active:
```bash
rhea-cli servers
```

Switch your active server:
```bash
rhea-cli use vps-cloud
# ✅ Now using server: vps-cloud
```

Set a persistent fallback order:
```bash
rhea-cli order primary-vps home-server mac-laptop
# ✅ Server fallback order updated!
```

Target a specific server for a one-off command (bypasses active server):
```bash
rhea-cli ask --server mac-laptop "Explain this code"
```

**MCP Integration:**
Configure your MCP client (like Claude Desktop) to run the server:
```json
{
  "mcpServers": {
    "rhea": {
      "command": "node",
      "args": ["/path/to/rhea/mcp/dist/index.js"]
    }
  }
}
```

---

## 🛡️ Security & Privacy

Rhea is designed for **Least Privilege**. You can restrict your server's `authorized_keys` to ensure clients can only execute the RPC interface:
```text
command="rhea-cli-server rpc",no-pty,no-port-forwarding ssh-ed25519 ...
```

All traffic is encrypted via **Tailscale/WireGuard**, keeping your model interactions private and secure.

---

## 🛠️ Configuration

Rhea stores configuration in:
- `~/.rhea-cli.json` (Client profiles and ordering)
- `~/.rhea-cli-server.json` (Server-side pairing tokens)

### Server Ordering
In `~/.rhea-cli.json`, you can define a fallback order:
```json
{
  "activeServer": "primary-vps",
  "order": ["primary-vps", "home-server", "mac-laptop"],
  "servers": { ... }
}
```
If `primary-vps` is offline, Rhea will automatically try `home-server`, then `mac-laptop`, before falling back to local execution.
