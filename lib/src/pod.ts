import { routeChatCompletion, Message } from './router.js';
import { getRolePrompt } from './prompts.js';
import { rpc } from './rpc.js';
import { ClientConfig, ServerProfile, getOrderedServers } from './config.js';
import { WorkflowProfile, RoleDefinition, defaultCodingProfile } from './workflow.js';

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
  public onActivity?: (data: { role: string, model: string, status: 'thinking' | 'done', content?: string }) => void;

  constructor(modelNames: string[], clientConfig: ClientConfig, adversarialRate: number = 0.07) {
    // Ensure we have exactly 3 models by recycling if needed
    if (modelNames.length === 0) {
      throw new Error("At least one model must be provided for the Rhea Pod.");
    }
    this.modelNames = [...modelNames];
    while (this.modelNames.length < 3) {
      this.modelNames.push(this.modelNames[this.modelNames.length % modelNames.length]);
    }
    
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
      roles?: RoleDefinition;
    } = {}
  ): Promise<PodResult> {
    const {
      context = "",
      maxRounds = (options.roles ? 1 : 3),
      timeLimit = 300,
      clarification = "",
      resumeState = null,
      roles = { dreamer: "dreamer", doubter: "doubter", decider: "decider" }
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

      // 1. Dreamer
      const proposal = await this.runRole(roles.dreamer, question, currentContext, rounds);

      // 2. Doubter
      const forceAdversarial = Math.random() < this.adversarialRate;
      const critique = await this.runRole(roles.doubter, question, currentContext, rounds, { proposal, adversarial: forceAdversarial });

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

      // 3. Decider
      const rawDecision = await this.runRole(roles.decider, question, currentContext, rounds, { proposal, critique });
      const decision = this.parseDeciderResponse(rawDecision);

      rounds.push({
        round: roundNum + 1,
        proposal,
        critique,
        decision,
        adversarial: forceAdversarial,
        roleMap: this.getRoleMap()
      });

      if (decision.confident || options.roles) break;

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

    if (role.includes("dreamer") || role === "architect") {
      userContent = `Question: ${question}`;
    } else if (role.includes("doubter") || role === "auditor") {
      userContent = `Original question: ${question}\n\nProposed implementation/plan:\n${opts.proposal}`;
    } else {
      userContent = `Original question: ${question}\n\nInitial proposal/plan:\n${opts.proposal}\n\nCritique and vulnerabilities found:\n${opts.critique}`;
    }

    if (context) userContent += `\n\nContext: ${context}`;
    if (history.length > 0) userContent += `\n\nPrevious rounds:\n${this.formatHistory(history)}`;

    const modelReq = this.modelNames[this.roles.indexOf(
      role.includes('dreamer') || role === 'architect' ? 'dreamer' : 
      role.includes('doubter') || role === 'auditor' ? 'doubter' : 
      'decider'
    )] || this.modelNames[0];
    const messages: Message[] = [{ role: "user", content: userContent }];

    if (this.onActivity) {
      this.onActivity({ role, model: modelReq, status: 'thinking' });
    }

    // Execution with Fallback
    const orderedServers = getOrderedServers(this.clientConfig);
    
    let resultText = "";

    for (const server of orderedServers) {
      try {
        const generator = rpc(server, 'ask', { model: modelReq, messages, system, stream: false });
        let result;
        for await (const chunk of generator) { result = chunk; }
        resultText = result.choices[0].message.content;
        break;
      } catch (e) {
        // Continue to next server
      }
    }

    if (!resultText) {
      // Local fallback
      const generator = routeChatCompletion(modelReq, messages, false, undefined, system);
      let result;
      for await (const chunk of generator) { result = chunk; }
      resultText = (result as any).choices[0].message.content;
    }

    if (this.onActivity) {
      this.onActivity({ role, model: modelReq, status: 'done', content: resultText });
    }

    return resultText;
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
      const parsed = JSON.parse(text);
      // If it's a standard Rhea response with an 'answer' key, return it.
      // Otherwise, if it's a raw JSON object (like a Plan), wrap it so 'answer' is the full string.
      if (parsed.answer) return parsed;
      return {
        answer: text,
        confidence: "high",
        confident: true,
        modifications: null,
        unresolved: null
      };
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

  async plan(requirement: string, context: string = "", profile: WorkflowProfile = defaultCodingProfile): Promise<any[]> {
    const result = await this.debate(requirement, { context, roles: profile.planner });
    const rawPlan = result.decision || "";

    try {
      // Clean up markdown
      let json = rawPlan.trim();
      if (json.includes('```')) {
        const lines = json.split('\n');
        json = lines.filter(l => !l.trim().startsWith('```')).join('\n').trim();
      }
      const parsed = JSON.parse(json);
      return parsed.tasks || [];
    } catch (e) {
      throw new Error(`Failed to parse planner output: ${rawPlan}`);
    }
  }

  async refine(requirement: string, changes: Record<string, string>, profile: WorkflowProfile = defaultCodingProfile): Promise<{ status: "APPROVED" | "REVISIONS NEEDED", feedback?: string }> {
    const changesText = Object.entries(changes).map(([file, content]) => `FILE: ${file}\n---\n${content}\n---`).join("\n\n");
    const question = `Original Requirement: ${requirement}\n\nProposed Changes:\n${changesText}`;
    
    const result = await this.debate(question, { roles: profile.refinery });
    const rawResponse = result.decision || "";

    if (rawResponse.includes("APPROVED")) {
      return { status: "APPROVED" };
    } else {
      return { status: "REVISIONS NEEDED", feedback: rawResponse };
    }
  }
}
