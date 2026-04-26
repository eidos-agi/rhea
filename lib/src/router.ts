import { spawn } from 'child_process';
import providers from '../../providers.json' with { type: 'json' };

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

export interface ImageApiProvider {
  type: 'image-api';
  api_type: 'openai' | 'stability' | 'fal';
  base_url: string;
  api_key_env: string;
  upstream_model: string;
}

export type Provider = CliProvider | OpenAIProvider | ImageApiProvider;

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
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface StreamChunk {
  id: string;
  object: "chat.completion.chunk";
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: Partial<Message>;
    finish_reason: string | null;
  }>;
}

const config = providers as Record<string, Provider>;

export async function* routeChatCompletion(
  modelReq: string, 
  messages: Message[], 
  stream: boolean = false,
  sessionId?: string
): AsyncGenerator<StreamChunk | OpenAIResponse> {
  const provider = config[modelReq];

  if (!provider) {
    throw new Error(`Model '${modelReq}' not found in providers.json`);
  }

  const prompt = messages.map(m => `${m.role.toUpperCase()}:\n${m.content}`).join('\n\n');

  if (provider.type === 'cli') {
    let args = provider.cmd.map(arg => arg.replace('{prompt}', prompt));
    if (sessionId) {
      args.push('--session', sessionId);
    }
    const command = args[0];
    const cmdArgs = args.slice(1);

    const child = spawn(command, cmdArgs);
    let fullContent = '';
    const id = `chatcmpl-${Math.random().toString(36).slice(2)}`;
    const created = Math.floor(Date.now() / 1000);

    for await (const chunk of (child.stdout as any)) {
      const content = chunk.toString();
      fullContent += content;
      if (stream) {
        yield {
          id,
          object: "chat.completion.chunk",
          created,
          model: modelReq,
          choices: [{ index: 0, delta: { content }, finish_reason: null }]
        };
      }
    }

    if (!stream) {
      yield {
        id,
        object: "chat.completion",
        created,
        model: modelReq,
        choices: [{ index: 0, message: { role: "assistant", content: fullContent.trim() }, finish_reason: "stop" }],
        usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
      };
    } else {
      yield {
        id,
        object: "chat.completion.chunk",
        created,
        model: modelReq,
        choices: [{ index: 0, delta: {}, finish_reason: "stop" }]
      };
    }

  } else if (provider.type === 'openai') {
    const apiKey = process.env[provider.api_key_env];
    if (!apiKey) {
      throw new Error(`Missing environment variable: ${provider.api_key_env}`);
    }

    const payload = { model: provider.upstream_model, messages, stream };
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

    if (!stream) {
      const data = await response.json();
      yield data;
    } else {
      const reader = response.body?.getReader();
      if (!reader) throw new Error("Failed to get reader from response body");

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const cleanLine = line.trim();
          if (!cleanLine || cleanLine === 'data: [DONE]') continue;
          if (cleanLine.startsWith('data: ')) {
            try {
              const chunk = JSON.parse(cleanLine.slice(6));
              yield chunk;
            } catch (e) {
              console.error("Failed to parse stream line:", cleanLine);
            }
          }
        }
      }
    }
  }
}
