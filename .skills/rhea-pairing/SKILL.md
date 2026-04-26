# Rhea Pairing Skill

A specialized guide for enrolling and managing Rhea remote server identities.

## The Pairing Flow
1. **Generate Code (Server)**:
   ```bash
   rhea-cli-server pair code [label]
   ```
   This generates a 6-character short code (e.g., `B3F2A1`) and stores a temporary record.

2. **Enroll Client (Client)**:
   ```bash
   rhea-cli pair <label> <host> --code <shortcode>
   ```
   The client connects via SSH, invokes the `exchange-code` RPC action, and receives a long-lived, randomly generated token.

## Security Mechanics
- **Transport**: Secured by Tailscale SSH node identity.
- **App-level Auth**: The `rhea_...` token is required for all RPC actions.
- **Revocation**: Tokens can be revoked on the server using `rhea-cli-server pair revoke <token>`.

## Troubleshooting
- **Reachability: Offline**: Ensure Tailscale is active and the host is reachable via `ssh <host>`.
- **Unauthorized**: The token may have been revoked or the config file `~/rhea/client.json` was modified.
