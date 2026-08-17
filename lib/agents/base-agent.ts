import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/queue";
import { callAgent, AgentOutput, Constraints, ProjectSpec, SYSTEM_PROMPTS } from "@/lib/nim";
import { AgentType, getAgentColor, getAgentIcon } from "@/lib/types";

export interface AgentContext {
  designId: string;
  prompt: string;
  constraints: Constraints;
  previousOutputs: Record<string, AgentOutput>;
  spec?: ProjectSpec;
}

export interface AgentRunResult {
  output: AgentOutput;
  duration: number;
}

export abstract class BaseAgent {
  abstract readonly type: AgentType;
  abstract readonly systemPrompt: string;

  protected async log(designId: string, message: string, level: "info" | "warn" | "error" | "debug" = "info", data?: unknown) {
    const event = {
      type: "log",
      timestamp: new Date().toISOString(),
      agent: this.type,
      message,
      data,
      level,
    };
    
    // Publish to Redis for SSE streaming
    await redis.publish(`design:${designId}:events`, JSON.stringify(event));
    
    // Also log to console
    const prefix = `[${this.type}]`;
    switch (level) {
      case "error":
        console.error(prefix, message, data);
        break;
      case "warn":
        console.warn(prefix, message, data);
        break;
      case "debug":
        console.debug(prefix, message, data);
        break;
      default:
        console.log(prefix, message, data);
    }
  }

  protected async emitAgentStart(designId: string) {
    const event = {
      type: "agent_start",
      timestamp: new Date().toISOString(),
      agent: this.type,
      message: `${this.type} agent started`,
      data: { color: getAgentColor(this.type), icon: getAgentIcon(this.type) },
      level: "info",
    };
    await redis.publish(`design:${designId}:events`, JSON.stringify(event));
  }

  protected async emitAgentComplete(designId: string, output: AgentOutput) {
    const event = {
      type: "agent_complete",
      timestamp: new Date().toISOString(),
      agent: this.type,
      message: `${this.type} agent completed`,
      data: { output, color: getAgentColor(this.type), icon: getAgentIcon(this.type) },
      level: "info",
    };
    await redis.publish(`design:${designId}:events`, JSON.stringify(event));
  }

  protected async emitAgentError(designId: string, error: Error) {
    const event = {
      type: "agent_error",
      timestamp: new Date().toISOString(),
      agent: this.type,
      message: `${this.type} agent error: ${error.message}`,
      data: { error: error.message, stack: error.stack },
      level: "error",
    };
    await redis.publish(`design:${designId}:events`, JSON.stringify(event));
  }

  async updateAgentRun(designId: string, updates: Partial<{
    status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
    output: AgentOutput;
    reasoning: string;
    confidence: number;
    warnings: string[];
    startedAt: Date;
    completedAt: Date;
  }>) {
    await prisma.agentRun.updateMany({
      where: { designId, agentType: this.type },
      data: updates,
    });
  }

  async execute(context: AgentContext): Promise<AgentRunResult> {
    const startTime = Date.now();
    
    await this.emitAgentStart(context.designId);
    await this.updateAgentRun(context.designId, {
      status: "PROCESSING",
      startedAt: new Date(),
    });
    await this.log(context.designId, `Starting ${this.type} analysis...`);

    try {
      // Call the agent with NIM
      const output = await callAgent(
        this.type,
        context.prompt,
        context.constraints,
        context.previousOutputs,
        context.designId
      );

      const duration = Date.now() - startTime;
      
      await this.updateAgentRun(context.designId, {
        status: "COMPLETED",
        output,
        reasoning: output.reasoning,
        confidence: output.confidence,
        warnings: output.warnings,
        completedAt: new Date(),
      });

      await this.emitAgentComplete(context.designId, output);
      await this.log(context.designId, `Completed in ${duration}ms`, "info", { confidence: output.confidence });

      return { output, duration };
    } catch (error) {
      const duration = Date.now() - startTime;
      const err = error as Error;
      
      await this.updateAgentRun(context.designId, {
        status: "FAILED",
        completedAt: new Date(),
      });
      
      await this.emitAgentError(context.designId, err);
      await this.log(context.designId, `Failed after ${duration}ms: ${err.message}`, "error", { error: err.message });
      
      throw error;
    }
  }

  // Helper to merge agent output into project spec
  protected mergeIntoSpec(spec: ProjectSpec, agentOutput: AgentOutput): ProjectSpec {
    // This is a base implementation - each agent can override
    return {
      ...spec,
      agentContributions: {
        ...spec.agentContributions,
        [this.type]: {
          agent: this.type,
          spec: agentOutput.spec,
          reasoning: agentOutput.reasoning,
          confidence: agentOutput.confidence,
        },
      },
    };
  }
}