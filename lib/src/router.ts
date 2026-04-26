import { execFile } from 'child_process';
import { promisify } from 'util';
import providers from '../../providers.json' with { type: 'json' };

const execFileAsync = promisify(execFile);

export interface CliProvider {
  type: 'cli';
  cmd: string[];
}

export interface OpenAIProvider {
  type: 'openai';
  base_url: string;
  api_key_env: string;
  upstream_model: string;
  headers?: Record<string, string>;
}

export type Provider = CliProvider | OpenAIProvider;

export interface Message {
  role: string;
  content: string;
}

export interface OpenAIResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: Message;
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

const config = providers as Record<string, Provider>;

export async function routeChatCompletion(modelReq: string, messages: Message[]): Promise<any> {
  const provider = config[modelReq];

  if (!provider) {
    throw new Error(`Model '${modelReq}' not found in providers.json`);
  }

  const prompt = messages.map(m => `${m.role.toUpperCase()}:\n${m.content}`).join('\n\n');

  if (provider.type === 'cli') {
    const args = provider.cmd.map(arg => arg.replace('{prompt}', prompt));
    const command = args[0];
    const cmdArgs = args.slice(1);

    try {
      const { stdout } = await execFileAsync(command, cmdArgs);
      return buildOpenAIResponse(modelReq, stdout.trim());
    } catch (err: any) {
      throw new Error(`CLI execution failed: ${err.message}`);
    }

  } else if (provider.type === 'openai') {
    const apiKey = process.env[provider.api_key_env];
    if (!apiKey) {
      throw new Error(`Missing environment variable: ${provider.api_key_env}`);
    }

    const payload = { model: provider.upstream_model, messages, stream: false };
    const endpoint = provider.base_url.endsWith('/chat/completions') 
      ? provider.base_url 
      : `${provider.base_url.replace(/\/$/, '')}/chat/completions`;

    const response = await fetch(endpoint, { 
      method: 'POST', 
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        ...(provider.headers || {})
      }, 
      body: JSON.stringify(payload) 
    });

    if (!response.ok) throw new Error(`API error from ${endpoint}: ${response.status}`);
    return await response.json();
  }
}

function buildOpenAIResponse(model: string, content: string): OpenAIResponse {
  return {
    id: `chatcmpl-${Math.random().toString(36).slice(2)}`,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: model,
    choices: [{ index: 0, message: { role: "assistant", content: content }, finish_reason: "stop" }],
    usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
  };
}
