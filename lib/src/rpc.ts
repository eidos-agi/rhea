import { spawn } from 'child_process';
import { ServerProfile } from './config.js';

export async function* rpc(
  server: ServerProfile, 
  action: string, 
  payloadData = {}
): AsyncGenerator<any> {
  const payload = JSON.stringify({ action, token: server.token, ...payloadData });
  
  // Spawn SSH. We invoke `rhea-cli-server rpc` directly.
  const ssh = spawn('ssh', [server.host, 'rhea-cli-server', 'rpc']);
  let stderr = '';

  // Handle stdout as an ndjson stream
  let buffer = '';
  
  // Create a promise to handle process completion and stderr
  const exitPromise = new Promise<void>((resolve, reject) => {
    ssh.stderr.on('data', (data: Buffer) => { stderr += data.toString(); });
    ssh.on('close', (code: number) => {
      if (code !== 0) {
        reject(new Error(`Server offline or unreachable.\nSSH Error: ${stderr.trim()}`));
      } else {
        resolve();
      }
    });
  });

  // Generator to read from stdout
  const readStdout = async function* () {
    for await (const chunk of ssh.stdout) {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const res = JSON.parse(line);
          if (res.error) throw new Error(res.error.message);
          yield res;
        } catch (err) {
          throw new Error(`Failed to parse server response: ${line}`);
        }
      }
    }
  };

  // Yield from the stdout reader
  yield* readStdout();

  // Wait for the process to exit
  await exitPromise;
}
