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
      mode?: 'general' | 'code' | 'plan' | 'refine';
    } = {}
  ): Promise<PodResult> {
    const {
      context = "",
      maxRounds = (options.mode === 'code' || options.mode === 'plan' || options.mode === 'refine' ? 1 : 3),
      timeLimit = 300,
      clarification = "",
      resumeState = null,
      mode = 'general'
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
      let dreamerRole = "dreamer";
      if (mode === 'code') dreamerRole = "architect";
      else if (mode === 'plan') dreamerRole = "planner_dreamer";
      else if (mode === 'refine') dreamerRole = "refinery_dreamer";
      const proposal = await this.runRole(dreamerRole, question, currentContext, rounds, { mode });

      // 2. Doubter
      let doubterRole = "doubter";
      if (mode === 'code') doubterRole = "auditor";
      else if (mode === 'plan') doubterRole = "planner_doubter";
      else if (mode === 'refine') doubterRole = "refinery_doubter";
      const forceAdversarial = Math.random() < this.adversarialRate;
      const critique = await this.runRole(doubterRole, question, currentContext, rounds, { proposal, adversarial: forceAdversarial, mode });

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
      let deciderRole = "decider";
      if (mode === 'code') deciderRole = "integrator";
      else if (mode === 'plan') deciderRole = "planner_decider";
      else if (mode === 'refine') deciderRole = "refinery_decider";
      const rawDecision = await this.runRole(deciderRole, question, currentContext, rounds, { proposal, critique, mode });
      const decision = this.parseDeciderResponse(rawDecision);

      rounds.push({
        round: roundNum + 1,
        proposal,
        critique,
        decision,
        adversarial: forceAdversarial,
        roleMap: this.getRoleMap()
      });

      if (decision.confident || mode === 'code' || mode === 'plan' || mode === 'refine') break;

      this.rotate();
    }

    return this.buildResult(rounds);
  }

  private async runRole(
    role: string, 
    question: string, 
    context: string, 
    history: PodRound[],
    opts: { proposal?: string, critique?: string, adversarial?: boolean, mode?: 'general' | 'code' | 'plan' | 'refine' } = {}
  ): Promise<string> {
    let system = "";
    if (opts.mode === 'code' || opts.mode === 'plan' || opts.mode === 'refine') {
      system = getRolePrompt(role);
    } else {
      system = getRolePrompt(role, opts.adversarial);
    }
    
    let userContent = "";

    if (role === "dreamer" || role === "architect" || role === "planner_dreamer" || role === "refinery_dreamer") {
      userContent = `Question: ${question}`;
    } else if (role === "doubter" || role === "auditor" || role === "planner_doubter" || role === "refinery_doubter") {
      userContent = `Original question: ${question}\n\nProposed implementation/plan:\n${opts.proposal}`;
    } else if (role === "decider" || role === "integrator" || role === "planner_decider" || role === "refinery_decider") {
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

  async plan(requirement: string, context: string = ""): Promise<any[]> {
    const system = getRolePrompt("planner");
    const userContent = `Requirement: ${requirement}\n\nContext:\n${context}`;
    const messages: Message[] = [{ role: "user", content: userContent }];

    const modelReq = this.modelNames[0]; // Use the primary model for planning
    const orderedServers = getOrderedServers(this.clientConfig);
    
    let rawPlan = "";

    for (const server of orderedServers) {
      try {
        const generator = rpc(server, 'ask', { model: modelReq, messages, system, stream: false });
        let result;
        for await (const chunk of generator) { result = chunk; }
        rawPlan = result.choices[0].message.content;
        break;
      } catch (e) {
        // Continue to next server
      }
    }

    if (!rawPlan) {
      const generator = routeChatCompletion(modelReq, messages, false);
      let result;
      for await (const chunk of generator) { result = chunk; }
      rawPlan = (result as any).choices[0].message.content;
    }

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

  async refine(requirement: string, changes: Record<string, string>): Promise<{ status: "APPROVED" | "REVISIONS NEEDED", feedback?: string }> {
    const system = getRolePrompt("refinery");
    const changesText = Object.entries(changes).map(([file, content]) => `FILE: ${file}\n---\n${content}\n---`).join("\n\n");
    const userContent = `Original Requirement: ${requirement}\n\nProposed Changes:\n${changesText}`;
    const messages: Message[] = [{ role: "user", content: userContent }];

    const modelReq = this.modelNames[0]; 
    const orderedServers = getOrderedServers(this.clientConfig);
    
    let rawResponse = "";

    for (const server of orderedServers) {
      try {
        const generator = rpc(server, 'ask', { model: modelReq, messages, system, stream: false });
        let result;
        for await (const chunk of generator) { result = chunk; }
        rawResponse = result.choices[0].message.content;
        break;
      } catch (e) { /* next */ }
    }

    if (!rawResponse) {
      const generator = routeChatCompletion(modelReq, messages, false);
      let result;
      for await (const chunk of generator) { result = chunk; }
      rawResponse = (result as any).choices[0].message.content;
    }

    if (rawResponse.includes("APPROVED")) {
      return { status: "APPROVED" };
    } else {
      return { status: "REVISIONS NEEDED", feedback: rawResponse };
    }
  }
}
