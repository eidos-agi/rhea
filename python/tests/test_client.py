import json
from unittest.mock import MagicMock, patch
import pytest
from rhea import RheaClient

@pytest.fixture
def mock_config(tmp_path):
    config_dir = tmp_path / "rhea"
    config_dir.mkdir()
    client_json = config_dir / "client.json"
    config = {
        "activeServer": "test-server",
        "servers": {
            "test-server": {"host": "user@test-host", "token": "test-token"}
        }
    }
    client_json.write_text(json.dumps(config))
    return config_dir

def test_client_init(mock_config):
    client = RheaClient(config_dir=str(mock_config))
    assert client.config["activeServer"] == "test-server"

@patch("subprocess.Popen")
def test_client_rpc(mock_popen, mock_config):
    mock_process = MagicMock()
    mock_popen.return_value = mock_process
    
    # Mock successful ndjson response
    mock_process.communicate.return_value = (json.dumps({"status": "ok", "version": "1.0.0"}), "")
    mock_process.returncode = 0
    
    client = RheaClient(config_dir=str(mock_config))
    responses = list(client.rpc("ping"))
    
    assert len(responses) == 1
    assert responses[0]["status"] == "ok"
    assert mock_popen.called

@patch("subprocess.Popen")
def test_client_ask(mock_popen, mock_config):
    mock_process = MagicMock()
    mock_popen.return_value = mock_process
    
    # Mock OpenAI-style response
    mock_response = {
        "choices": [{"message": {"content": "Ottawa"}}]
    }
    mock_process.communicate.return_value = (json.dumps(mock_response), "")
    mock_process.returncode = 0
    
    client = RheaClient(config_dir=str(mock_config))
    answer = client.ask("claude-pro", "Capital of Canada?")
    
    assert answer == "Ottawa"
