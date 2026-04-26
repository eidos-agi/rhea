# Rhea Server Installation Skill

A comprehensive guide for setting up a Rhea server node (e.g., Mac laptop, Linux Cloud VM, or Home Server).

## Prerequisites
- **Node.js**: Version 18 or higher.
- **Tailscale**: Installed and **Tailscale SSH** enabled.
- **Model CLIs**: Ensure your chosen model CLIs are installed and authenticated (e.g., `claude`, `gemini`).

## Setup Steps
1. **Clone & Build**:
   ```bash
   git clone git@github.com:eidos-agi/rhea.git
   cd rhea
   npm install
   npm run build
   ```

2. **Link Binary**:
   ```bash
   cd cli
   npm link
   ```

3. **Configure Providers**:
   Edit `providers.json` in the project root to map your local CLI commands.

4. **Option A: On-Demand (RPC)**
   No daemon required. Ensure `rhea-cli-server` is in the `PATH` of the SSH user.

5. **Option B: Always-On (Daemon)**
   ```bash
   rhea-cli-server daemon 8787
   ```
   Or use the provided `rhea-cli-server.service` template for systemd on Linux.

## Security (Forced Commands)
To restrict SSH access, add this to `~/.ssh/authorized_keys`:
```text
command="rhea-cli-server rpc",no-pty,no-port-forwarding ssh-ed25519 ...
```

## Management
- **Generate Pairing Code**: `rhea-cli-server pair code [label]`
- **Revoke Tokens**: `rhea-cli-server pair revoke <token>`
