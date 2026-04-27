import json
import os
import subprocess
from pathlib import Path
from typing import Dict, Any, List, Optional, Generator

class RheaClient:
    def __init__(self, config_dir: Optional[str] = None):
        self.config_dir = Path(config_dir or os.path.expanduser("~/rhea"))
        self.client_config_path = self.config_dir / "client.json"
        self.config = self._load_config()

    def _load_config(self) -> Dict[str, Any]:
        if not self.client_config_path.exists():
            return {"activeServer": None, "servers": {}}
        try:
            with open(self.client_config_path, "r") as f:
                return json.load(f)
        except Exception:
            return {"activeServer": None, "servers": {}}

    def rpc(self, action: str, params: Dict[str, Any] = {}, server_label: Optional[str] = None) -> Generator[Dict[str, Any], None, None]:
        label = server_label or self.config.get("activeServer")
        if not label or label not in self.config.get("servers", {}):
            raise ValueError(f"Server '{label}' not found or no active server configured.")

        server = self.config["servers"][label]
        payload = json.dumps({"action": action, "token": server["token"], **params})

        # Command: ssh <host> rhea-cli-server rpc
        cmd = ["ssh", server["host"], "rhea-cli-server", "rpc"]
        
        process = subprocess.Popen(
            cmd,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )

        stdout, stderr = process.communicate(input=payload)

        if process.returncode != 0:
            raise RuntimeError(f"RPC failed: {stderr.strip()}")

        for line in stdout.splitlines():
            if not line.strip():
                continue
            try:
                res = json.loads(line)
                if "error" in res:
                    raise RuntimeError(res["error"]["message"])
                yield res
            except json.JSONDecodeError:
                raise RuntimeError(f"Failed to parse server response: {line}")

    def ask(self, model: str, prompt: str, session_id: Optional[str] = None) -> str:
        messages = [{"role": "user", "content": prompt}]
        params = {"model": model, "messages": messages, "stream": False}
        if session_id:
            params["sessionId"] = session_id

        result = ""
        for chunk in self.rpc("ask", params):
            # Non-streaming ask returns OpenAI-style response
            if "choices" in chunk:
                result = chunk["choices"][0]["message"]["content"]
        return result

    def list_models(self) -> List[str]:
        for res in self.rpc("list"):
            return res.get("models", [])
        return []
