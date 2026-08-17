import { OrchestratorAgent } from "./orchestrator-agent";
import { MechanicalAgent } from "./mechanical-agent";
import { ElectricalAgent } from "./electrical-agent";
import { ThermalAgent } from "./thermal-agent";
import { ManufacturingAgent } from "./manufacturing-agent";
import { CostAgent } from "./cost-agent";
import { BaseAgent, AgentContext, AgentRunResult } from "./base-agent";
import { AgentType, AGENT_CONFIG, getAgentExecutionOrder } from "@/lib/types";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/queue";

// Agent instances
const agents: Record<AgentType, BaseAgent> = {
  ORCHESTRATOR: new OrchestratorAgent(),
  MECHANICAL: new MechanicalAgent(),
  ELECTRICAL: new ElectricalAgent(),
  THERMAL: new ThermalAgent(),
  MANUFACTURING: new ManufacturingAgent(),
  COST: new CostAgent(),
};

export function getAgent(type: AgentType): BaseAgent {
  return agents[type];
}

export function getAllAgents(): BaseAgent[] {
  return Object.values(agents);
}

export function getRequiredAgents(designId: string): Promise<AgentType[]> {
  // This will be populated by the orchestrator after initial parsing
  // For now, return all agents in execution order
  return Promise.resolve(getAgentExecutionOrder());
}

export async function runOrchestration(designId: string, prompt: string, constraints: any) {
  const context: AgentContext = {
    designId,
    prompt,
    constraints,
    previousOutputs: {},
  };

  const results: Record<string, AgentRunResult> = {};
  const executionOrder = getAgentExecutionOrder();
  
  // First, run orchestrator to parse prompt and determine required agents
  const orchestrator = agents.ORCHESTRATOR;
  await orchestrator.execute(context);
  
  // Get the orchestrator output
  const orchestratorRun = await prisma.agentRun.findFirst({
    where: { designId, agentType: "ORCHESTRATOR" },
    orderBy: { createdAt: "desc" },
  });
  
  if (orchestratorRun?.output) {
    context.previousOutputs.ORCHESTRATOR = orchestratorRun.output as any;
  }
  
  // Determine which agents to run based on orchestrator output
  // For Phase 1, run all agents in order (skipping orchestrator since already done)
  const agentsToRun = executionOrder.filter(a => a !== "ORCHESTRATOR");
  
  // Run agents in parallel where possible (respecting dependencies)
  // For Phase 1, we run sequentially for simplicity
  for (const agentType of agentsToRun) {
    const agent = agents[agentType];
    
    try {
      const result = await agent.execute(context);
      results[agentType] = result;
      context.previousOutputs[agentType] = result.output;
    } catch (error) {
      console.error(`Agent ${agentType} failed:`, error);
      // Continue with other agents even if one fails
      context.previousOutputs[agentType] = {
        agent: agentType,
        status: "error",
        spec: {},
        reasoning: `Agent failed: ${(error as Error).message}`,
        confidence: 0,
        warnings: [(error as Error).message],
      } as any;
    }
    
    // Emit progress event
    await redis.publish(`design:${designId}:events`, JSON.stringify({
      type: "job_update",
      timestamp: new Date().toISOString(),
      agent: agentType,
      message: `${agentType} agent completed`,
      data: { progress: agentsToRun.indexOf(agentType) + 1, total: agentsToRun.length },
      level: "info",
    }));
  }
  
  // Finally, run orchestrator synthesis
  const orchestratorAgent = agents.ORCHESTRATOR as any; // Type assertion for synthesize method
  if (orchestratorAgent.synthesize) {
    const finalSpec = await orchestratorAgent.synthesize(designId, context.previousOutputs);
    context.spec = finalSpec;
  }
  
  // Update design status
  await prisma.design.update({
    where: { id: designId },
    data: { 
      status: "CAD_GENERATING",
      spec: context.spec,
    },
  });
  
  // Emit completion event
  await redis.publish(`design:${designId}:events`, JSON.stringify({
    type: "complete",
    timestamp: new Date().toISOString(),
    message: "All agents completed. Design ready for CAD generation.",
    data: { spec: context.spec },
    level: "info",
  }));
  
  return { spec: context.spec, agentOutputs: context.previousOutputs };
}

export { BaseAgent, AgentContext, AgentRunResult };