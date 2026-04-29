export type FailureKind =
  | "auth_required"
  | "missing_key"
  | "timeout"
  | "empty"
  | "rate_limited"
  | "network"
  | "bad_response"
  | "bad_model"
  | "unknown";

export type AttemptOutcome = "success" | FailureKind;
export type RingDirection = "clockwise" | "counterclockwise";

export interface AttemptTrace {
  role: string;
  requestedModel: string;
  actualModel: string;
  providerLocation: "local" | "remote";
  server?: string;
  outcome: AttemptOutcome;
  durationMs: number;
  fallbackReason?: string;
  message?: string;
}

export interface ModelRing {
  name: string;
  models: string[];
  direction: RingDirection;
  step: number;
  offset: number;
}

export interface ModelFieldState {
  seed: string;
  round: number;
  rings: ModelRing[];
  ejected: string[];
  cooldowns: Record<string, number>;
}

function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  return () => {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createSeed(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export class ModelField {
  private seed: string;
  private round = 0;
  private rings: ModelRing[];
  private ejected = new Set<string>();
  private cooldowns = new Map<string, number>();

  constructor(models: string[], seed: string = createSeed()) {
    if (models.length === 0) {
      throw new Error("ModelField requires at least one model.");
    }

    this.seed = seed;
    const rng = mulberry32(hashSeed(seed));
    const uniqueModels = Array.from(new Set(models));
    const offset = Math.floor(rng() * uniqueModels.length);

    this.rings = [
      {
        name: "provider",
        models: uniqueModels,
        direction: "counterclockwise",
        step: 1,
        offset,
      },
    ];
  }

  getSeed(): string {
    return this.seed;
  }

  getState(): ModelFieldState {
    return {
      seed: this.seed,
      round: this.round,
      rings: this.rings.map(r => ({ ...r, models: [...r.models] })),
      ejected: Array.from(this.ejected),
      cooldowns: Object.fromEntries(this.cooldowns),
    };
  }

  nextCandidates(role: string, preferredModel?: string): string[] {
    const ring = this.rings[0];
    const active = ring.models.filter(model => !this.ejected.has(model) && !this.isCoolingDown(model));
    if (active.length === 0) return [];

    const direction = ring.direction === "clockwise" ? 1 : -1;
    const roleShift = role.length % active.length;
    const preferredShift = preferredModel && active.includes(preferredModel) ? active.indexOf(preferredModel) : 0;
    const rawStart = ring.offset + preferredShift + roleShift + direction * this.round * ring.step;
    const start = ((rawStart % active.length) + active.length) % active.length;

    return [...active.slice(start), ...active.slice(0, start)];
  }

  recordOutcome(model: string, outcome: AttemptOutcome): void {
    if (outcome === "success") {
      this.cooldowns.delete(model);
      return;
    }

    if (outcome === "auth_required" || outcome === "missing_key" || outcome === "bad_model") {
      this.ejected.add(model);
      this.cooldowns.delete(model);
      return;
    }

    if (outcome === "timeout" || outcome === "network" || outcome === "rate_limited") {
      this.cooldowns.set(model, Math.max(this.round + 1, this.round + 2));
      return;
    }

    if (outcome === "empty" || outcome === "bad_response") {
      this.cooldowns.set(model, this.round + 1);
    }
  }

  advance(): void {
    this.round++;
    for (const [model, untilRound] of this.cooldowns) {
      if (untilRound <= this.round) {
        this.cooldowns.delete(model);
      }
    }
  }

  private isCoolingDown(model: string): boolean {
    const untilRound = this.cooldowns.get(model);
    return untilRound !== undefined && untilRound > this.round;
  }
}
