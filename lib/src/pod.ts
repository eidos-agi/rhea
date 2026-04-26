import { routeChatCompletion, Message } from './router.js';
import { getRolePrompt } from './prompts.js';
import { rpc } from './rpc.js';
import { ClientConfig, ServerProfile, getOrderedServers } from './config.js';

export interface PodRound {
  round: number;
  proposal: string;
  critique: string;
  decision: any;
  adversarial: boolean;
  roleMap: Record<string, string>;
}

export interface PodResult {
  status: "decision" | "needs_clarification";
  decision?: string;
  confidence?: string;
  clarification_question?: string;
  rounds: PodRound[];
  dissent: string[];
  rotation_count: number;
  resume_state?: any;
}

export class Pod {
  private roles: string[] = ["dreamer", "doubter", "decider"];
  private rotationCount: number = 0;
  private modelNames: string[];
  private adversarialRate: number;
  private clientConfig: ClientConfig;

  constructor(modelNames: string[], clientConfig: ClientConfig, adversarialRate: number = 0.07) {
    this.modelNames = modelNames;
    this.clientConfig = clientConfig;
    this.adversarialRate = adversarialRate;
    
    // Shuffle initial roles
    for (let i = this.roles.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.roles[i], this.roles[j]] = [this.roles[j], this.roles[i]];
    }
  }

  async debate(
    question: string,
    options: {
      context?: string;
      maxRounds?: number;
      timeLimit?: number;
      clarification?: string;
      resumeState?: any;
    } = {}
  ): Promise<PodResult> {
    const {
      context = "",
      maxRounds = 3,
      timeLimit = 300,
      clarification = "",
      resumeState = null
    } = options;

    let rounds: PodRound[] = [];
    let startRound = 0;
    const startTime = Date.now();
    let currentContext = context;

    if (resumeState && clarification) {
      rounds = resumeState.rounds || [];
      startRound = rounds.length;
      this.rotationCount = resumeState.rotation_count || 0;
      currentContext = (currentContext ? currentContext + "\n\n" : "") + `Clarification from the caller: ${clarification}`;
    }

    for (let roundNum = startRound; roundNum < maxRounds; roundNum++) {
      const elapsed = (Date.now() - startTime) / 1000;
      if (elapsed >= timeLimit) break;

      // 1. Dreamer proposes
      const proposal = await this.runRole("dreamer", question, currentContext, rounds);

      // 2. Doubter critiques
      const forceAdversarial = Math.random() < this.adversarialRate;
      const critique = await this.runRole("doubter", question, currentContext, rounds, { proposal, adversarial: forceAdversarial });

      // Check for clarification
      if (critique.trim().startsWith("CLARIFICATION NEEDED:")) {
        const clarificationQuestion = critique.split("CLARIFICATION NEEDED:")[1].trim();
        const round: PodRound = {
          round: roundNum + 1,
          proposal,
          critique,
          decision: { answer: "paused for clarification", confident: false },
          adversarial: forceAdversarial,
          roleMap: this.getRoleMap()
        };
        rounds.push(round);
        return this.buildClarificationResult(rounds, clarificationQuestion);
      }

      // 3. Decider rules
      const rawDecision = await this.runRole("decider", question, currentContext, rounds, { proposal, critique });
      const decision = this.parseDeciderResponse(rawDecision);

      rounds.push({
        round: roundNum + 1,
        proposal,
        critique,
        decision,
        adversarial: forceAdversarial,
        roleMap: this.getRoleMap()
      });

      if (decision.confident) break;

      this.rotate();
    }

    return this.buildResult(rounds);
  }

  private async runRole(
    role: string, 
    question: string, 
    context: string, 
    history: PodRound[],
    opts: { proposal?: string, critique?: string, adversarial?: boolean } = {}
  ): Promise<string> {
    const system = getRolePrompt(role, opts.adversarial);
    let userContent = "";

    if (role === "dreamer") {
      userContent = `Question: ${question}`;
    } else if (role === "doubter") {
      userContent = `Original question: ${question}\n\nDreamer's proposal:\n${opts.proposal}`;
    } else if (role === "decider") {
      userContent = `Original question: ${question}\n\nDreamer's proposal:\n${opts.proposal}\n\nDoubter's critique:\n${opts.critique}`;
    }

    if (context) userContent += `\n\nContext: ${context}`;
    if (history.length > 0) userContent += `\n\nPrevious rounds:\n${this.formatHistory(history)}`;

    const modelReq = this.modelNames[this.roles.indexOf(role)] || this.modelNames[0];
    const messages: Message[] = [{ role: "user", content: userContent }];

    // Execution with Fallback
    const orderedServers = getOrderedServers(this.clientConfig);
    
    for (const server of orderedServers) {
      try {
        const generator = rpc(server, 'ask', { model: modelReq, messages, stream: false });
        let result;
        for await (const chunk of generator) { result = chunk; }
        return result.choices[0].message.content;
      } catch (e) {
        // Continue to next server
      }
    }

    // Local fallback
    const generator = routeChatCompletion(modelReq, messages, false);
    let result;
    for await (const chunk of generator) { result = chunk; }
    return (result as any).choices[0].message.content;
  }

  private rotate() {
    const d = this.roles.indexOf("dreamer");
    const db = this.roles.indexOf("doubter");
    const dc = this.roles.indexOf("decider");
    const newRoles = new Array(3);
    newRoles[d] = "doubter";
    newRoles[db] = "decider";
    newRoles[dc] = "dreamer";
    this.roles = newRoles;
    this.rotationCount++;
  }

  private getRoleMap(): Record<string, string> {
    const map: Record<string, string> = {};
    this.roles.forEach((role, idx) => {
      map[this.modelNames[idx] || `model-${idx}`] = role;
    });
    return map;
  }

  private formatHistory(rounds: PodRound[]): string {
    return rounds.map(r => 
      `Round ${r.round}:\n  Proposal: ${r.proposal.slice(0, 300)}...\n  Critique: ${r.critique.slice(0, 300)}...\n  Decision: ${r.decision.answer?.slice(0, 300)}...`
    ).join("\n");
  }

  private parseDeciderResponse(raw: string): any {
    let text = raw.trim();
    if (text.startsWith("```")) {
      const lines = text.split("\n");
      text = lines.filter(l => !l.trim().startsWith("```")).join("\n").trim();
    }
    try {
      return JSON.parse(text);
    } catch (e) {
      return {
        answer: raw,
        confidence: "medium",
        confident: false,
        modifications: null,
        unresolved: "Could not parse structured response"
      };
    }
  }

  private buildClarificationResult(rounds: PodRound[], question: string): PodResult {
    return {
      status: "needs_clarification",
      clarification_question: question,
      rounds,
      dissent: [],
      rotation_count: this.rotationCount,
      resume_state: { rounds, rotation_count: this.rotationCount }
    };
  }

  private buildResult(rounds: PodRound[]): PodResult {
    if (rounds.length === 0) {
      return {
        status: "decision",
        decision: "No rounds completed.",
        confidence: "low",
        rounds: [],
        dissent: [],
        rotation_count: 0
      };
    }
    const last = rounds[rounds.length - 1];
    return {
      status: "decision",
      decision: last.decision.answer,
      confidence: last.decision.confidence,
      rounds,
      dissent: rounds.map(r => r.decision.unresolved).filter(u => u && u !== "null"),
      rotation_count: this.rotationCount
    };
  }
}
