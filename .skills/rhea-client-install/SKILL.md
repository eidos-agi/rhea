# Rhea Client Installation Skill

A comprehensive guide for setting up a Rhea client on a new machine.

## Prerequisites
- **Node.js**: Version 18 or higher.
- **Tailscale**: Installed and authenticated.
- **SSH Client**: Configured to access remote Rhea servers via Tailscale.

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

3. **Pair with a Server**:
   Obtain a pairing code from your Rhea server and run:
   ```bash
   rhea-cli pair <label> <user@tailscale-host> --code <shortcode>
   ```

4. **Verify**:
   ```bash
   rhea-cli status
   ```

## Configuration
The client configuration is stored in `~/rhea/client.json`. You can manually adjust the `order` array here to define your preferred fallback sequence.
