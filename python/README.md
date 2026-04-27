# Rhea Python Client

Python client for [Rhea](https://github.com/eidos-agi/rhea): Sovereign Model Orchestration.

Rhea turns your existing, subscription-backed AI CLIs (Claude Pro, Gemini Advanced) into secure, remote, and always-on private APIs.

## Installation

```bash
pip install rhea-agi
```

*Note: Requires a Rhea server to be configured and reachable via SSH.*

## Usage

```python
from rhea import RheaClient

# Initialize client (uses ~/rhea/client.json by default)
client = RheaClient()

# List available models on the active server
models = client.list_models()
print(f"Available models: {models}")

# Ask a question
response = client.ask("claude-pro", "What is the capital of Canada?")
print(f"Response: {response}")
```

## Features

- **Sovereign Orchestration**: Communicates with your own Rhea mesh over secure SSH tunnels.
- **JSON-RPC Support**: Full access to the Rhea server-side actions.
- **Minimal Dependencies**: Lightweight and fast.

## License

Rhea is licensed under **Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0)**.
