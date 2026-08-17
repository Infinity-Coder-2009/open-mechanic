import { BaseAgent, AgentContext, AgentRunResult } from "./base-agent";
import { AgentType, ProjectSpec, Constraints, AgentOutput, getAgentExecutionOrder } from "@/lib/types";
import { parsePromptWithNIM, SYSTEM_PROMPTS } from "@/lib/nim";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/queue";

export class OrchestratorAgent extends BaseAgent {
  readonly type: AgentType = "ORCHESTRATOR";
  readonly systemPrompt = SYSTEM_PROMPTS.ORCHESTRATOR;

  async execute(context: AgentContext): Promise<AgentRunResult> {
    const startTime = Date.now();
    
    await this.emitAgentStart(context.designId);
    await this.updateAgentRun(context.designId, {
      status: "PROCESSING",
      startedAt: new Date(),
    });
    await this.log(context.designId, "Parsing prompt and creating execution plan...");

    try {
      // Parse the prompt into a ProjectSpec
      const spec = await parsePromptWithNIM(context.prompt, context.constraints);
      
      // Determine which agents are needed based on the spec
      const requiredAgents = this.determineRequiredAgents(spec);
      
      // Create AgentRun records for all required agents
      await this.createAgentRuns(context.designId, requiredAgents);
      
      // Store the initial spec
      await prisma.design.update({
        where: { id: context.designId },
        data: { spec },
      });

      const output: AgentOutput = {
        agent: "ORCHESTRATOR",
        status: "complete",
        spec: spec as Record<string, unknown>,
        reasoning: `Parsed prompt into ${spec.type} design. Identified ${requiredAgents.length} required sub-agents: ${requiredAgents.join(", ")}. Created execution plan with ${getAgentExecutionOrder().filter(a => requiredAgents.includes(a)).length} parallel phases.`,
        confidence: 0.9,
        warnings: [],
        nextAgentHints: requiredAgents.map(a => `Execute ${a} agent`),
      };

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
      await this.log(context.designId, `Orchestration complete. Required agents: ${requiredAgents.join(", ")}`, "info", { requiredAgents });

      return { output, duration };
    } catch (error) {
      const duration = Date.now() - startTime;
      const err = error as Error;
      
      await this.updateAgentRun(context.designId, {
        status: "FAILED",
        completedAt: new Date(),
      });
      
      await this.emitAgentError(context.designId, err);
      await this.log(context.designId, `Orchestration failed: ${err.message}`, "error", { error: err.message });
      
      throw error;
    }
  }

  private determineRequiredAgents(spec: ProjectSpec): AgentType[] {
    const agents: AgentType[] = ["MECHANICAL"]; // Always need mechanical
    
    // Check if electrical systems are needed
    const hasElectrical = spec.subAssemblies.some(sa => 
      sa.function.toLowerCase().includes("motor") ||
      sa.function.toLowerCase().includes("actuat") ||
      sa.function.toLowerCase().includes("power") ||
      sa.function.toLowerCase().includes("sensor") ||
      sa.function.toLowerCase().includes("control") ||
      spec.powerSource !== "pneumatic"
    );
    if (hasElectrical) agents.push("ELECTRICAL");

    // Check if thermal analysis is needed
    const hasThermal = spec.subAssemblies.some(sa =>
      sa.function.toLowerCase().includes("motor") ||
      sa.function.toLowerCase().includes("power") ||
      sa.function.toLowerCase().includes("battery") ||
      spec.environment === "industrial" ||
      spec.environment === "space"
    );
    if (hasThermal) agents.push("THERMAL");

    // Manufacturing always needed for physical products
    agents.push("MANUFACTURING");

    // Cost analysis always needed
    agents.push("COST");

    return agents;
  }

  private async createAgentRuns(designId: string, agents: AgentType[]) {
    const runs = agents.map(agent => ({
      designId,
      agentType: agent,
      status: "PENDING" as const,
      input: {},
      warnings: [] as string[],
    }));

    await prisma.agentRun.createMany({ data: runs });
  }

  // Synthesize all agent outputs into final spec
  async synthesize(designId: string, agentOutputs: Record<string, AgentOutput>): Promise<ProjectSpec> {
    await this.log(designId, "Synthesizing agent outputs into unified specification...");

    // Get the base spec from orchestrator
    const orchestratorOutput = agentOutputs.ORCHESTRATOR;
    let spec = orchestratorOutput?.spec as unknown as ProjectSpec || {} as ProjectSpec;

    // Merge each agent's contribution
    for (const [agentType, output] of Object.entries(agentOutputs)) {
      if (agentType === "ORCHESTRATOR") continue;
      
      spec = this.mergeAgentOutput(spec, agentType as AgentType, output);
    }

    // Resolve conflicts
    spec = this.resolveConflicts(spec, agentOutputs);

    // Update design with final spec
    await prisma.design.update({
      where: { id: designId },
      data: { 
        spec,
        agentOutputs: agentOutputs as Record<string, unknown>,
        status: "APPROVAL_NEEDED",
      },
    });

    await this.log(designId, "Synthesis complete. Design ready for review.", "info", { 
      subAssemblies: spec.subAssemblies?.length,
      hasConflicts: false 
    });

    return spec;
  }

  private mergeAgentOutput(spec: ProjectSpec, agentType: AgentType, output: AgentOutput): ProjectSpec {
    const agentSpec = output.spec as Record<string, unknown>;
    
    // Update sub-assemblies with agent-specific data
    if (spec.subAssemblies && agentSpec.subAssemblies) {
      const agentSubAssemblies = agentSpec.subAssemblies as Array<Record<string, unknown>>;
      
      spec.subAssemblies = spec.subAssemblies.map((sa, index) => {
        const agentSA = agentSubAssemblies[index] || {};
        return {
          ...sa,
          [agentType.toLowerCase()]: agentSA[agentType.toLowerCase()] || sa[agentType.toLowerCase()],
        };
      });
    }

    // Add agent contribution for traceability
    if (!spec.agentContributions) spec.agentContributions = {};
    spec.agentContributions[agentType] = {
      agent: agentType,
      spec: agentSpec,
      reasoning: output.reasoning,
      confidence: output.confidence,
    };

    return spec;
  }

  private resolveConflicts(spec: ProjectSpec, agentOutputs: Record<string, AgentOutput>): ProjectSpec {
    // Check for weight budget conflicts
    const totalWeight = spec.subAssemblies?.reduce((sum, sa) => {
      const mech = sa.mechanical as Record<string, unknown> | undefined;
      return sum + (Number(mech?.weight) || 0);
    }, 0) || 0;

    if (totalWeight > spec.weight * 1.1) {
      spec.warnings = spec.warnings || [];
      spec.warnings.push(`Total estimated weight (${totalWeight}g) exceeds target (${spec.weight}g) by >10%`);
    }

    // Check budget conflicts
    const costOutput = agentOutputs.COST?.spec as Record<string, unknown> | undefined;
    const estimatedCost = Number(costOutput?.totalCost) || 0;
    if (estimatedCost > spec.budget * 1.2) {
      spec.warnings = spec.warnings || [];
      spec.warnings.push(`Estimated cost ($${estimatedCost}) exceeds budget ($${spec.budget}) by >20%`);
    }

    return spec;
  }
}