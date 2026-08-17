import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateObject } from "ai";
import { z } from "zod";

// NVIDIA NIM Configuration
const nimBaseUrl = process.env.NVIDIA_NIM_BASE_URL || "https://integrate.api.nvidia.com/v1";
const nimApiKey = process.env.NVIDIA_API_KEY;
const nimModel = process.env.NVIDIA_NIM_MODEL || "meta/llama-3.1-70b-instruct";

if (!nimApiKey) {
  console.warn("NVIDIA_API_KEY not set - NIM integration will fail");
}

export const nim = createOpenAICompatible({
  name: "nvidia-nim",
  baseURL: nimBaseUrl,
  apiKey: nimApiKey || "dummy-key",
});

// Zod schemas for structured output
export const ConstraintsSchema = z.object({
  maxHeight: z.number().optional().describe("Maximum height in mm"),
  maxWeight: z.number().optional().describe("Maximum weight in grams"),
  maxBudget: z.number().optional().describe("Maximum budget in USD"),
  environment: z.enum(["indoor", "outdoor", "industrial", "space"]).optional(),
  powerSource: z.enum(["battery", "mains", "solar", "pneumatic"]).optional(),
  customConstraints: z.record(z.unknown()).optional(),
});

export type Constraints = z.infer<typeof ConstraintsSchema>;

export const SubAssemblySchema = z.object({
  name: z.string(),
  function: z.string(),
  constraints: z.record(z.unknown()).optional(),
  mechanical: z.object({
    material: z.string().optional(),
    process: z.string().optional(),
    safetyFactor: z.number().optional(),
  }).optional(),
  electrical: z.object({
    voltage: z.number().optional(),
    power: z.number().optional(),
    current: z.number().optional(),
  }).optional(),
  thermal: z.object({
    maxTemp: z.number().optional(),
    cooling: z.string().optional(),
    heatDissipation: z.number().optional(),
  }).optional(),
});

export const ProjectSpecSchema = z.object({
  type: z.string().describe("Product type: wall_fan, drone, robotic_arm, etc."),
  height: z.number().describe("Overall height in mm"),
  weight: z.number().describe("Total weight in grams"),
  payload: z.number().describe("Payload capacity in grams"),
  budget: z.number().describe("Target budget in USD"),
  environment: z.enum(["indoor", "outdoor", "industrial", "space"]),
  powerSource: z.enum(["battery", "mains", "solar", "pneumatic"]),
  successMetrics: z.array(z.string()).describe("Key success metrics"),
  subAssemblies: z.array(SubAssemblySchema),
  // Agent contributions for traceability
  agentContributions: z.record(
    z.object({
      agent: z.string(),
      spec: z.unknown(),
      reasoning: z.string(),
      confidence: z.number(),
    })
  ).optional(),
});

export type ProjectSpec = z.infer<typeof ProjectSpecSchema>;

// Agent-specific output schemas
export const AgentOutputSchema = z.object({
  agent: z.enum(["ORCHESTRATOR", "MECHANICAL", "ELECTRICAL", "THERMAL", "MANUFACTURING", "COST"]),
  status: z.enum(["thinking", "complete", "error", "needs_review"]),
  spec: z.record(z.unknown()),
  reasoning: z.string(),
  confidence: z.number().min(0).max(1),
  warnings: z.array(z.string()),
  questionsForHuman: z.array(z.string()).optional(),
  nextAgentHints: z.array(z.string()).optional(),
});

export type AgentOutput = z.infer<typeof AgentOutputSchema>;

// System prompts for each agent
export const SYSTEM_PROMPTS = {
  ORCHESTRATOR: `You are the Lead Systems Engineer orchestrating a team of specialized engineering agents.
Your role is to:
1. Parse the user's natural language prompt into a high-level ProjectSpec
2. Determine which sub-agents are needed for this design
3. Coordinate the agents and synthesize their outputs into a unified specification
4. Flag any conflicts or items requiring human review

Output a valid JSON object matching the ProjectSpec schema. Be precise with numbers and units.`,
  
  MECHANICAL: `You are a Senior Mechanical Engineer specializing in structural design, kinematics, and manufacturing.
Given the prompt and constraints, provide:
1. Mechanical architecture and sub-assembly breakdown
2. Material selections with justification
3. Manufacturing processes (CNC, injection molding, 3D printing, sheet metal)
4. Structural analysis requirements (safety factors, load cases)
5. Tolerance specifications
6. Weight estimates per sub-assembly

Output your contribution to the ProjectSpec with mechanical details for each sub-assembly.`,
  
  ELECTRICAL: `You are a Senior Electrical Engineer specializing in power systems, control systems, and PCB design.
Given the prompt and constraints, provide:
1. Power architecture (battery/mains/solar, voltage levels, regulation)
2. Actuator selection and sizing (motors, servos, solenoids)
3. Sensor requirements and placement
4. PCB/PCBA strategy (layers, components, connectors)
5. Wiring harness design
6. Power budget and efficiency estimates
7. Safety and compliance considerations (UL, CE, FCC)

Output your contribution with electrical details for each sub-assembly.`,
  
  THERMAL: `You are a Thermal Engineer specializing in heat transfer, CFD, and cooling systems.
Given the prompt and constraints, provide:
1. Heat generation analysis per component
2. Thermal management strategy (passive, active, liquid, phase change)
3. Airflow requirements and fan specifications
4. Maximum operating temperatures
5. Thermal stress considerations
6. Simulation requirements (CFD, FEA thermal)

Output your contribution with thermal details for each sub-assembly.`,
  
  MANUFACTURING: `You are a Manufacturing Engineer specializing in DFM, tooling, and production planning.
Given the prompt and constraints, provide:
1. Design for Manufacturability (DFM) analysis
2. Tooling requirements (molds, fixtures, jigs)
3. Assembly sequence and fixturing
4. Tolerance stack-up analysis
5. Quality control checkpoints
6. Production volume considerations
7. Supply chain risk assessment

Output your contribution with manufacturing details for each sub-assembly.`,
  
  COST: `You are a Cost Engineer specializing in BOM costing, supplier management, and value engineering.
Given the prompt and constraints, provide:
1. Bill of Materials with estimated unit costs
2. Supplier recommendations (DigiKey, Mouser, LCSC, McMaster-Carr, etc.)
3. Volume pricing tiers
4. Make vs. buy analysis
5. Cost reduction opportunities
6. Budget compliance assessment

Output your contribution with cost details for each sub-assembly.`,
};

// Parse prompt with NIM
export async function parsePromptWithNIM(
  prompt: string,
  constraints: Constraints
): Promise<ProjectSpec> {
  const systemPrompt = SYSTEM_PROMPTS.ORCHESTRATOR;
  
  const userPrompt = `User Prompt: "${prompt}"

Constraints:
${JSON.stringify(constraints, null, 2)}

Parse this into a complete ProjectSpec. Determine the product type, key dimensions, and required sub-assemblies.`;

  const { object } = await generateObject({
    model: nim(nimModel),
    system: systemPrompt,
    prompt: userPrompt,
    schema: ProjectSpecSchema,
    temperature: 0.3,
    maxTokens: 4000,
  });

  return object;
}

// Call specific agent
export async function callAgent(
  agentType: keyof typeof SYSTEM_PROMPTS,
  prompt: string,
  constraints: Constraints,
  previousOutputs: Record<string, AgentOutput>,
  designId: string
): Promise<AgentOutput> {
  const systemPrompt = SYSTEM_PROMPTS[agentType];
  
  const userPrompt = `Design ID: ${designId}
User Prompt: "${prompt}"

Constraints:
${JSON.stringify(constraints, null, 2)}

Previous Agent Outputs:
${JSON.stringify(previousOutputs, null, 2)}

Provide your engineering contribution as a structured AgentOutput. Focus on your domain expertise.`;

  const { object } = await generateObject({
    model: nim(nimModel),
    system: systemPrompt,
    prompt: userPrompt,
    schema: AgentOutputSchema,
    temperature: 0.4,
    maxTokens: 4000,
  });

  return object;
}