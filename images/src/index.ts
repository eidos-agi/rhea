import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { Provider } from '@rhea/lib';

export interface ImageGenerationOptions {
  modelReq: string;
  prompt: string;
  sessionId?: string;
  aspectRatio?: string;
  size?: string;
}

export interface ImageResponse {
  object: "image";
  created: number;
  data: Array<{
    b64_json?: string;
    url?: string;
    revised_prompt?: string;
  }>;
}

export async function generateImage(
  options: ImageGenerationOptions, 
  config: Record<string, Provider>
): Promise<ImageResponse> {
  const { modelReq, prompt, sessionId, aspectRatio, size } = options;
  const provider = config[modelReq];

  if (!provider) {
    throw new Error(`Model '${modelReq}' not found in providers.json`);
  }

  if (provider.type === 'cli') {
    const tempFile = path.join(os.tmpdir(), `rhea-${Math.random().toString(36).slice(2)}.png`);
    let args = provider.cmd.map(arg => 
      arg.replace('{prompt}', prompt).replace('{output}', tempFile)
    );
    
    // Nano Banana 2 features: session, aspect-ratio, size
    if (sessionId) {
      args.push('--session', sessionId);
    }
    if (aspectRatio) {
      args.push('--aspect-ratio', aspectRatio);
    }
    if (size) {
      args.push('--size', size);
    }
    
    const command = args[0];
    const cmdArgs = args.slice(1);

    return new Promise((resolve, reject) => {
      const child = spawn(command, cmdArgs);
      let stderr = '';
      
      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        if (code !== 0) {
          return reject(new Error(`CLI image generation failed with code ${code}.\nStderr: ${stderr}`));
        }
        if (!fs.existsSync(tempFile)) {
          return reject(new Error("Image file was not created by CLI"));
        }
        const b64 = fs.readFileSync(tempFile, 'base64');
        fs.unlinkSync(tempFile);
        
        resolve({
          object: "image",
          created: Math.floor(Date.now() / 1000),
          data: [{ b64_json: b64 }]
        });
      });
    });
  } else {
    throw new Error(`Provider type '${provider.type}' not supported for image generation.`);
  }
}
