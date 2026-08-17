import { z } from "zod";

// ============================================
// Core Types
// ============================================

export const ConstraintsSchema = z.object({
  maxHeight: z.number().optional(),
  maxWeight: z.number().optional(),
  maxBudget: z.number().optional(),
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

export type SubAssembly = z.infer<typeof SubAssemblySchema>;

export const ProjectSpecSchema = z.object({
  type: z.string(),
  height: z.number(),
  weight: z.number(),
  payload: z.number(),
  budget: z.number(),
  environment: z.enum(["indoor", "outdoor", "industrial", "space"]),
  powerSource: z.enum(["battery", "mains", "solar", "pneumatic"]),
  successMetrics: z.array(z.string()),
  subAssemblies: z.array(SubAssemblySchema),
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

export type AgentType = "ORCHESTRATOR" | "MECHANICAL" | "ELECTRICAL" | "THERMAL" | "MANUFACTURING" | "COST";

export type DesignStatus = "QUEUED" | "PARSING" | "AGENTS_RUNNING" | "CAD_GENERATING" | "SIMULATING" | "APPROVAL_NEEDED" | "COMPLETE" | "FAILED";

export type JobType = "CAD" | "SIM" | "EVOLVE" | "AGENT_ORCHESTRATION";

export type JobStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";

// ============================================
// API Types
// ============================================

export const OrchestrateRequestSchema = z.object({
  prompt: z.string().min(1).max(5000),
  constraints: ConstraintsSchema.optional(),
});

export type OrchestrateRequest = z.infer<typeof OrchestrateRequestSchema>;

export const OrchestrateResponseSchema = z.object({
  jobId: z.string(),
  status: z.literal("queued"),
  spec: ProjectSpecSchema.optional(),
});

export type OrchestrateResponse = z.infer<typeof OrchestrateResponseSchema>;

export const DesignListItemSchema = z.object({
  id: z.string(),
  prompt: z.string(),
  status: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  spec: z.unknown().optional(),
});

export type DesignListItem = z.infer<typeof DesignListItemSchema>;

// ============================================
// SSE Event Types
// ============================================

export const SSEEventSchema = z.object({
  type: z.enum(["log", "agent_start", "agent_complete", "agent_error", "job_update", "design_update", "complete", "error"]),
  timestamp: z.string(),
  agent: z.string().optional(),
  message: z.string(),
  data: z.unknown().optional(),
  level: z.enum(["info", "warn", "error", "debug"]).default("info"),
});

export type SSEEvent = z.infer<typeof SSEEventSchema>;

// ============================================
// Worker Job Data Types
// ============================================

export const OrchestrationJobDataSchema = z.object({
  designId: z.string(),
  prompt: z.string(),
  constraints: ConstraintsSchema,
});

export type OrchestrationJobData = z.infer<typeof OrchestrationJobDataSchema>;

export const CadJobDataSchema = z.object({
  designId: z.string(),
  spec: ProjectSpecSchema,
});

export type CadJobData = z.infer<typeof CadJobDataSchema>;

export const SimJobDataSchema = z.object({
  designId: z.string(),
  cadResult: z.record(z.unknown()),
});

export type SimJobData = z.infer<typeof SimJobDataSchema>;

// ============================================
// Python CAD Service Types
// ============================================

export const FanParametersSchema = z.object({
  blade_diameter: z.number(),
  blade_count: z.number().int().positive(),
  pitch_angle: z.number(),
  hub_diameter: z.number().optional(),
  blade_thickness: z.number().optional(),
  motor_shaft_diameter: z.number().optional(),
});

export type FanParameters = z.infer<typeof FanParametersSchema>;

export const PythonCadRequestSchema = z.object({
  type: z.literal("fan"),
  parameters: FanParametersSchema,
});

export type PythonCadRequest = z.infer<typeof PythonCadRequestSchema>;

export const PythonCadResponseSchema = z.object({
  success: z.boolean(),
  stl_path: z.string().optional(),
  error: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type PythonCadResponse = z.infer<typeof PythonCadResponseSchema>;

// ============================================
// Agent Configuration
// ============================================

export const AGENT_CONFIG = {
  ORCHESTRATOR: {
    name: "Orchestrator",
    color: "#FFFFFF",
    icon: "cpu",
    description: "Lead Systems Engineer - coordinates all agents",
    order: 0,
    dependencies: [],
  },
  MECHANICAL: {
    name: "Mechanical",
    color: "#00FF88",
    icon: "cog",
    description: "Structural design, materials, manufacturing processes",
    order: 1,
    dependencies: ["ORCHESTRATOR"],
  },
  ELECTRICAL: {
    name: "Electrical",
    color: "#FF6B00",
    icon: "zap",
    description: "Power systems, actuators, sensors, PCB design",
    order: 1,
    dependencies: ["ORCHESTRATOR"],
  },
  THERMAL: {
    name: "Thermal",
    color: "#FF006E",
    icon: "flame",
    description: "Heat transfer, cooling, CFD analysis",
    order: 2,
    dependencies: ["MECHANICAL", "ELECTRICAL"],
  },
  MANUFACTURING: {
    name: "Manufacturing",
    color: "#8B5CF6",
    icon: "factory",
    description: "DFM, tooling, assembly, quality control",
    order: 2,
    dependencies: ["MECHANICAL"],
  },
  COST: {
    name: "Cost",
    color: "#FFB700",
    icon: "calculator",
    description: "BOM costing, supplier management, value engineering",
    order: 3,
    dependencies: ["MECHANICAL", "ELECTRICAL", "MANUFACTURING"],
  },
} as const satisfies Record<AgentType, {
  name: string;
  color: string;
  icon: string;
  description: string;
  order: number;
  dependencies: AgentType[];
}>;

// ============================================
// Utility Functions
// ============================================

export function getAgentExecutionOrder(): AgentType[] {
  // Topological sort based on dependencies
  const visited = new Set<AgentType>();
  const result: AgentType[] = [];
  
  function visit(agent: AgentType) {
    if (visited.has(agent)) return;
    visited.add(agent);
    
    for (const dep of AGENT_CONFIG[agent].dependencies) {
      visit(dep);
    }
    result.push(agent);
  }
  
  for (const agent of Object.keys(AGENT_CONFIG) as AgentType[]) {
    visit(agent);
  }
  
  return result;
}

export function getAgentColor(agent: AgentType): string {
  return AGENT_CONFIG[agent].color;
}

export function getAgentIcon(agent: AgentType): string {
  return AGENT_CONFIG[agent].icon;
}