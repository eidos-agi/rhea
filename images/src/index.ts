import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { Provider, ImageApiProvider } from '@rhea/lib';

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
    return handleCliImage(options, provider);
  } else if (provider.type === 'image-api') {
    return handleApiImage(options, provider);
  } else {
    throw new Error(`Provider type '${provider.type}' not supported for image generation.`);
  }
}

async function handleCliImage(options: ImageGenerationOptions, provider: any): Promise<ImageResponse> {
  const { prompt, sessionId, aspectRatio, size } = options;
  const tempFile = path.join(os.tmpdir(), `rhea-${Math.random().toString(36).slice(2)}.png`);
  let args = provider.cmd.map((arg: string) => 
    arg.replace('{prompt}', prompt).replace('{output}', tempFile)
  );
  
  if (sessionId) args.push('--session', sessionId);
  if (aspectRatio) args.push('--aspect-ratio', aspectRatio);
  if (size) args.push('--size', size);
  
  const command = args[0];
  const cmdArgs = args.slice(1);

  return new Promise((resolve, reject) => {
    const child = spawn(command, cmdArgs);
    let stderr = '';
    child.stderr.on('data', (data) => stderr += data.toString());
    child.on('close', (code) => {
      if (code !== 0) return reject(new Error(`CLI image generation failed with code ${code}.\n${stderr}`));
      if (!fs.existsSync(tempFile)) return reject(new Error("Image file was not created by CLI"));
      const b64 = fs.readFileSync(tempFile, 'base64');
      fs.unlinkSync(tempFile);
      resolve({
        object: "image",
        created: Math.floor(Date.now() / 1000),
        data: [{ b64_json: b64 }]
      });
    });
  });
}

async function handleApiImage(options: ImageGenerationOptions, provider: ImageApiProvider): Promise<ImageResponse> {
  const { prompt, aspectRatio, size } = options;
  const apiKey = process.env[provider.api_key_env];
  if (!apiKey) throw new Error(`Missing environment variable: ${provider.api_key_env}`);

  switch (provider.api_type) {
    case 'openai':
      return callOpenAI(prompt, apiKey, provider.upstream_model, size);
    case 'openrouter':
      return callOpenRouter(prompt, apiKey, provider.upstream_model, aspectRatio, size);
    case 'stability':
      return callStability(prompt, apiKey, provider.upstream_model, aspectRatio);
    case 'fal':
      return callFal(prompt, apiKey, provider.upstream_model);
    default:
      throw new Error(`Unsupported image API type: ${provider.api_type}`);
  }
}

async function callOpenAI(prompt: string, apiKey: string, model: string, size?: string): Promise<ImageResponse> {
  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      prompt,
      n: 1,
      size: size === '2k' ? '1024x1792' : (size || '1024x1024'),
      response_format: 'b64_json'
    })
  });
  if (!response.ok) throw new Error(`OpenAI API error: ${response.status} ${await response.text()}`);
  return await response.json();
}

async function callOpenRouter(prompt: string, apiKey: string, model: string, aspectRatio?: string, size?: string): Promise<ImageResponse> {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json', 
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://github.com/eidos-agi/rhea',
      'X-Title': 'Rhea AI Orchestrator'
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      modalities: ["image"],
      aspect_ratio: aspectRatio,
      size
    })
  });

  if (!response.ok) throw new Error(`OpenRouter API error: ${response.status} ${await response.text()}`);
  const data = await response.json() as any;
  
  let b64 = "";
  const message = data.choices[0].message;
  
  // Exhaustive search for image data in the response
  if (message.images && message.images.length > 0) {
    const rawImage = message.images[0];
    b64 = typeof rawImage === 'string' ? (rawImage.includes('base64,') ? rawImage.split('base64,')[1] : rawImage) : (rawImage.base64 || "");
  } else if (message.content && typeof message.content === 'string') {
    if (message.content.includes('base64,')) {
      b64 = message.content.split('base64,')[1].split('"')[0].split(')')[0].split('\n')[0];
    } else if (message.content.startsWith('http')) {
      // It's a URL, fetch it
      const imgRes = await fetch(message.content.trim());
      const buffer = await imgRes.arrayBuffer();
      b64 = Buffer.from(buffer).toString('base64');
    }
  }

  if (!b64) {
    // Check for tool calls or reasoning outputs that might contain the data
    const strData = JSON.stringify(data);
    if (strData.includes('base64,')) {
      b64 = strData.split('base64,')[1].split('"')[0];
    } else {
      throw new Error(`Could not find image data in OpenRouter response. Payload: ${JSON.stringify(data)}`);
    }
  }

  return {
    object: "image",
    created: Math.floor(Date.now() / 1000),
    data: [{ b64_json: b64 }]
  };
}

async function callStability(prompt: string, apiKey: string, model: string, aspectRatio?: string): Promise<ImageResponse> {
  const ratioMap: Record<string, string> = { "16:9": "16:9", "1:1": "1:1", "4:3": "4:3", "9:16": "9:16" };
  const formData = new FormData();
  formData.append('prompt', prompt);
  formData.append('output_format', 'png');
  if (aspectRatio) formData.append('aspect_ratio', ratioMap[aspectRatio] || aspectRatio);
  const response = await fetch(`https://api.stability.ai/v2beta/stable-image/generate/${model}`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Accept': 'application/json' },
    body: formData
  });
  if (!response.ok) throw new Error(`Stability API error: ${response.status} ${await response.text()}`);
  const data = await response.json() as any;
  return {
    object: "image",
    created: Math.floor(Date.now() / 1000),
    data: [{ b64_json: data.image }]
  };
}

async function callFal(prompt: string, apiKey: string, model: string): Promise<ImageResponse> {
  const response = await fetch(`https://fal.run/fal-ai/${model}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Key ${apiKey}` },
    body: JSON.stringify({ prompt })
  });
  if (!response.ok) throw new Error(`FAL.ai API error: ${response.status} ${await response.text()}`);
  const data = await response.json() as any;
  const imgRes = await fetch(data.images[0].url);
  const buffer = await imgRes.arrayBuffer();
  return {
    object: "image",
    created: Math.floor(Date.now() / 1000),
    data: [{ b64_json: Buffer.from(buffer).toString('base64') }]
  };
}
