import { spawn } from 'child_process';
import { ServerProfile } from './config.js';

export function rpc(server: ServerProfile, action: string, payloadData = {}): Promise<any> {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({ action, token: server.token, ...payloadData });
    
    // Spawn SSH. We invoke `rhea-cli-server rpc` directly.
    const ssh = spawn('ssh', [server.host, 'rhea-cli-server', 'rpc']);
    let stdout = '';
    let stderr = '';

    ssh.stdout.on('data', (data: Buffer) => { stdout += data.toString(); });
    ssh.stderr.on('data', (data: Buffer) => { stderr += data.toString(); });

    ssh.on('close', (code: number) => {
      if (code !== 0) {
        return reject(new Error(`Server offline or unreachable.\nSSH Error: ${stderr.trim()}`));
      }
      try {
        const res = JSON.parse(stdout.trim());
        if (res.error) return reject(new Error(res.error.message));
        resolve(res);
      } catch (err) {
        reject(new Error(`Failed to parse server response: ${stdout}`));
      }
    });

    // Send payload over stdin
    ssh.stdin.write(payload);
    ssh.stdin.end();
  });
}
