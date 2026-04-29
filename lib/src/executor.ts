import { ClientConfig, getOrderedServers } from './config.js';
import { ModelField, AttemptTrace, FailureKind } from './model-field.js';
import { Message, routeChatCompletion } from './router.js';
import { rpc } from './rpc.js';

export interface RetryPolicy {
  timeoutMs: number;
  maxAttemptsPerCandidate: number;
  maxCandidates?: number;
}

export interface ExecuteTextOptions {
  role: string;
  requestedModel: string;
  messages: Message[];
  system?: string;
  sessionId?: string;
  clientConfig: ClientConfig;
  modelField: ModelField;
  retryPolicy?: Partial<RetryPolicy>;
}

export interface ExecuteTextResult {
  content: string;
  model: string;
  attempts: AttemptTrace[];
}

export class RheaExecutionError extends Error {
  attempts: AttemptTrace[];

  constructor(message: string, attempts: AttemptTrace[]) {
    super(message);
    this.name = "RheaExecutionError";
    this.attempts = attempts;
  }
}

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  timeoutMs: 45_000,
  maxAttemptsPerCandidate: 2,
};

export async function executeTextWithField(options: ExecuteTextOptions): Promise<ExecuteTextResult> {
  const policy = { ...DEFAULT_RETRY_POLICY, ...(options.retryPolicy || {}) };
  const candidates = options.modelField.nextCandidates(options.role, options.requestedModel);
  const attempts: AttemptTrace[] = [];
  const maxCandidates = policy.maxCandidates ?? candidates.length;

  for (const model of candidates.slice(0, maxCandidates)) {
    for (let attemptNum = 0; attemptNum < policy.maxAttemptsPerCandidate; attemptNum++) {
      const remoteResult = await tryRemote(model, options, policy.timeoutMs, attempts);
      if (remoteResult) return remoteResult;

      const localResult = await tryLocal(model, options, policy.timeoutMs, attempts);
      if (localResult) return localResult;

      const last = attempts[attempts.length - 1];
      if (last && !isRetryable(last.outcome)) break;
    }
  }

  throw new RheaExecutionError("All Rhea model candidates failed.", attempts);
}

export function classifyFailure(error: unknown): FailureKind {
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();

  if (lower.includes("missing environment variable") || lower.includes("api key") && lower.includes("missing")) return "missing_key";
  if (lower.includes("not logged in") || lower.includes("please run /login") || lower.includes("login") || lower.includes("authentication page")) return "auth_required";
  if (lower.includes("timed out") || lower.includes("timeout")) return "timeout";
  if (lower.includes("rate limit") || lower.includes("429")) return "rate_limited";
  if (lower.includes("model") && (lower.includes("not found") || lower.includes("unsupported"))) return "bad_model";
  if (lower.includes("network") || lower.includes("econnreset") || lower.includes("enotfound") || lower.includes("server offline") || lower.includes("unreachable")) return "network";
  if (lower.includes("empty")) return "empty";
  if (lower.includes("parse") || lower.includes("choices")) return "bad_response";
  return "unknown";
}

function isRetryable(outcome: AttemptTrace["outcome"]): boolean {
  return outcome === "timeout" || outcome === "network" || outcome === "rate_limited" || outcome === "empty" || outcome === "bad_response";
}

async function tryRemote(
  model: string,
  options: ExecuteTextOptions,
  timeoutMs: number,
  attempts: AttemptTrace[],
): Promise<ExecuteTextResult | null> {
  for (const server of getOrderedServers(options.clientConfig)) {
    const started = Date.now();
    try {
      const result = await withTimeout(async () => {
        const generator = rpc(server, 'ask', {
          model,
          messages: options.messages,
          system: options.system,
          stream: false,
          sessionId: options.sessionId,
        });
        let chunk: any;
        for await (const next of generator) chunk = next;
        const content = chunk?.choices?.[0]?.message?.content?.trim();
        if (!content) throw new Error("Empty response from remote model.");
        return content;
      }, timeoutMs);

      const trace = traceAttempt(options.role, options.requestedModel, model, "remote", "success", started, server.name);
      attempts.push(trace);
      options.modelField.recordOutcome(model, "success");
      return { content: result, model, attempts };
    } catch (err) {
      const failure = classifyFailure(err);
      attempts.push(traceAttempt(options.role, options.requestedModel, model, "remote", failure, started, server.name, err));
      options.modelField.recordOutcome(model, failure);
      if (!isRetryable(failure)) return null;
    }
  }
  return null;
}

async function tryLocal(
  model: string,
  options: ExecuteTextOptions,
  timeoutMs: number,
  attempts: AttemptTrace[],
): Promise<ExecuteTextResult | null> {
  const started = Date.now();
  try {
    const result = await withTimeout(async () => {
      const generator = routeChatCompletion(model, options.messages, false, options.sessionId, options.system, { timeoutMs });
      let chunk: any;
      for await (const next of generator) chunk = next;
      const content = chunk?.choices?.[0]?.message?.content?.trim();
      if (!content) throw new Error("Empty response from local model.");
      return content;
    }, timeoutMs + 500);

    attempts.push(traceAttempt(options.role, options.requestedModel, model, "local", "success", started));
    options.modelField.recordOutcome(model, "success");
    return { content: result, model, attempts };
  } catch (err) {
    const failure = classifyFailure(err);
    attempts.push(traceAttempt(options.role, options.requestedModel, model, "local", failure, started, undefined, err));
    options.modelField.recordOutcome(model, failure);
    return null;
  }
}

function traceAttempt(
  role: string,
  requestedModel: string,
  actualModel: string,
  providerLocation: "local" | "remote",
  outcome: AttemptTrace["outcome"],
  started: number,
  server?: string,
  err?: unknown,
): AttemptTrace {
  const message = err instanceof Error ? err.message : err ? String(err) : undefined;
  return {
    role,
    requestedModel,
    actualModel,
    providerLocation,
    server,
    outcome,
    durationMs: Date.now() - started,
    fallbackReason: outcome === "success" ? undefined : outcome,
    message,
  };
}

async function withTimeout<T>(fn: () => Promise<T>, timeoutMs: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      fn(),
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Timed out after ${timeoutMs}ms`)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
