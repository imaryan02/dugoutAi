import type { AgentActivity, AgentOutput, AgentRunInput, DetectedMoment } from "@agent11/shared";
import { getTriggeredAgents } from "./registry.js";
import { runCricketAgent } from "./adkRunner.js";

export interface OrchestratorHooks {
  onActivity?: (activity: AgentActivity) => void;
  onOutput?: (output: AgentOutput) => void;
}

export class AgentOrchestrator {
  constructor(private readonly hooks: OrchestratorHooks = {}) {}

  async run(input: AgentRunInput): Promise<AgentOutput[]> {
    const agents = getTriggeredAgents(input.moment.type);

    const runs = agents.map(async (agent) => {
      this.emitActivity(agent.id, agent.label, "thinking", `Analyzing ${input.moment.title.toLowerCase()}`);
      const output = await runCricketAgent(agent, input);
      this.emitActivity(agent.id, agent.label, output.speak ? "speaking" : "done", output.text);
      this.hooks.onOutput?.(output);
      return output;
    });

    const outputs = await Promise.all(runs);
    this.emitVoiceActivity(input.moment, outputs);
    return outputs.sort((a, b) => b.priority - a.priority);
  }

  private emitActivity(agentId: AgentActivity["agentId"], label: string, status: AgentActivity["status"], detail: string) {
    this.hooks.onActivity?.({
      agentId,
      label,
      status,
      detail,
      updatedAt: Date.now()
    });
  }

  private emitVoiceActivity(moment: DetectedMoment, outputs: AgentOutput[]) {
    const spoken = outputs
      .filter((output) => output.speak)
      .sort((a, b) => b.priority - a.priority)[0];

    if (!spoken) {
      return;
    }

    this.emitActivity("voice", "Voice Agent", "speaking", `Queued ${spoken.label} for ${moment.title.toLowerCase()}`);
  }
}
