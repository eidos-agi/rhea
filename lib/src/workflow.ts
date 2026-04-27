import { getRolePrompt } from './prompts.js';

export interface RoleDefinition {
  dreamer: string;
  doubter: string;
  decider: string;
}

export interface WorkflowProfile {
  name: string;
  planner: RoleDefinition;
  worker: RoleDefinition;
  refinery: RoleDefinition;
}

/**
 * The default coding workflow profile that replicates the previous hardcoded behavior.
 */
export const defaultCodingProfile: WorkflowProfile = {
  name: "coding",
  planner: {
    dreamer: "planner_dreamer",
    doubter: "planner_doubter",
    decider: "planner_decider"
  },
  worker: {
    dreamer: "architect",
    doubter: "auditor",
    decider: "integrator"
  },
  refinery: {
    dreamer: "refinery_dreamer",
    doubter: "refinery_doubter",
    decider: "refinery_decider"
  }
};
