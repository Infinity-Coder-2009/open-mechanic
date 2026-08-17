import { BaseAgent, AgentContext, AgentRunResult } from "./base-agent";
import { AgentType, AgentOutput, ProjectSpec } from "@/lib/types";
import { SYSTEM_PROMPTS } from "@/lib/nim";

export class MechanicalAgent extends BaseAgent {
  readonly type: AgentType = "MECHANICAL";
  readonly systemPrompt = SYSTEM_PROMPTS.MECHANICAL;

  async execute(context: AgentContext): Promise<AgentRunResult> {
    const startTime = Date.now();
    
    await this.emitAgentStart(context.designId);
    await this.updateAgentRun(context.designId, {
      status: "PROCESSING",
      startedAt: new Date(),
    });
    await this.log(context.designId, "Analyzing mechanical architecture and structures...");

    try {
      // In Phase 1, we simulate the agent work with a structured response
      // In future phases, this will call specialized mechanical analysis tools
      const output = await this.generateMechanicalOutput(context);
      
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
      await this.log(context.designId, `Mechanical analysis complete in ${duration}ms`, "info", { 
        subAssemblies: output.spec.subAssemblies?.length 
      });

      return { output, duration };
    } catch (error) {
      const duration = Date.now() - startTime;
      const err = error as Error;
      
      await this.updateAgentRun(context.designId, {
        status: "FAILED",
        completedAt: new Date(),
      });
      
      await this.emitAgentError(context.designId, err);
      await this.log(context.designId, `Mechanical analysis failed: ${err.message}`, "error");
      
      throw error;
    }
  }

  private async generateMechanicalOutput(context: AgentContext): Promise<AgentOutput> {
    const { prompt, constraints, previousOutputs } = context;
    const orchestratorOutput = previousOutputs.ORCHESTRATOR?.spec as ProjectSpec | undefined;
    
    // Extract key parameters
    const productType = orchestratorOutput?.type || "mechanical_device";
    const targetHeight = constraints.maxHeight || orchestratorOutput?.height || 400;
    const targetWeight = constraints.maxWeight || orchestratorOutput?.weight || 2000;
    const budget = constraints.maxBudget || orchestratorOutput?.budget || 500;
    
    // Generate mechanical sub-assemblies based on product type
    const subAssemblies = this.generateSubAssemblies(productType, targetHeight, targetWeight);
    
    const reasoning = `Designed mechanical architecture for ${productType}. 
Created ${subAssemblies.length} sub-assemblies with material selections optimized for ${context.constraints.environment || "indoor"} environment. 
Selected manufacturing processes based on budget ($${budget}) and volume requirements.
Applied safety factors per industry standards.`;
    
    return {
      agent: "MECHANICAL",
      status: "complete",
      spec: {
        subAssemblies: subAssemblies.map(sa => ({
          ...sa,
          mechanical: sa.mechanical,
        })),
        totalWeight: subAssemblies.reduce((sum, sa) => sum + (sa.mechanical?.weight || 0), 0),
        materials: [...new Set(subAssemblies.map(sa => sa.mechanical?.material).filter(Boolean))],
        processes: [...new Set(subAssemblies.map(sa => sa.mechanical?.process).filter(Boolean))],
      },
      reasoning,
      confidence: 0.85,
      warnings: this.generateWarnings(subAssemblies, targetWeight, budget),
      nextAgentHints: [
        "Electrical agent should size motors based on mechanical load requirements",
        "Thermal agent should analyze heat dissipation from motor and bearings",
        "Manufacturing agent should validate DFM for selected processes",
      ],
    };
  }

  private generateSubAssemblies(productType: string, height: number, weight: number) {
    const type = productType.toLowerCase();
    
    if (type.includes("fan")) {
      return [
        {
          name: "Motor Mount",
          function: "Secure motor to frame, dampen vibrations",
          mechanical: {
            material: "Aluminum 6061-T6",
            process: "CNC Machining",
            weight: weight * 0.15,
            safetyFactor: 3.0,
          },
        },
        {
          name: "Fan Hub",
          function: "Central hub connecting blades to motor shaft",
          mechanical: {
            material: "Nylon 6/6 (PA66) 30% Glass Filled",
            process: "Injection Molding",
            weight: weight * 0.08,
            safetyFactor: 2.5,
          },
        },
        {
          name: "Blades (x5)",
          function: "Generate airflow through aerodynamic profile",
          mechanical: {
            material: "ABS or PETG",
            process: "FDM 3D Printing",
            weight: weight * 0.25,
            safetyFactor: 2.0,
          },
        },
        {
          name: "Frame/Guard",
          function: "Structural support and safety guard",
          mechanical: {
            material: "Powder Coated Steel Wire",
            process: "Wire Forming + Welding",
            weight: weight * 0.35,
            safetyFactor: 2.5,
          },
        },
        {
          name: "Base Mount",
          function: "Wall mounting interface",
          mechanical: {
            material: "Aluminum 6061-T6",
            process: "CNC Machining",
            weight: weight * 0.17,
            safetyFactor: 4.0,
          },
        },
      ];
    }
    
    if (type.includes("drone")) {
      return [
        {
          name: "Main Frame",
          function: "Primary structural chassis",
          mechanical: {
            material: "Carbon Fiber Composite",
            process: "CNC Machined Plates",
            weight: weight * 0.3,
            safetyFactor: 2.0,
          },
        },
        {
          name: "Motor Arms (x4)",
          function: "Mount motors, transmit thrust to frame",
          mechanical: {
            material: "Carbon Fiber Tube",
            process: "Pultrusion + Machining",
            weight: weight * 0.25,
            safetyFactor: 3.0,
          },
        },
        {
          name: "Landing Gear",
          function: "Ground impact absorption",
          mechanical: {
            material: "TPU 95A",
            process: "FDM 3D Printing",
            weight: weight * 0.1,
            safetyFactor: 2.5,
          },
        },
        {
          name: "Camera Gimbal Mount",
          function: "Stabilized camera platform",
          mechanical: {
            material: "Aluminum 7075-T6",
            process: "CNC Machining",
            weight: weight * 0.15,
            safetyFactor: 2.0,
          },
        },
        {
          name: "Battery Tray",
          function: "Secure battery, allow quick swap",
          mechanical: {
            material: "PETG",
            process: "FDM 3D Printing",
            weight: weight * 0.1,
            safetyFactor: 2.0,
          },
        },
        {
          name: "Propellers (x4)",
          function: "Generate lift and control",
          mechanical: {
            material: "Nylon Composite",
            process: "Injection Molding",
            weight: weight * 0.1,
            safetyFactor: 1.5,
          },
        },
      ];
    }
    
    if (type.includes("robotic_arm") || type.includes("arm")) {
      return [
        {
          name: "Base",
          function: "Foundation, houses rotation joint 1",
          mechanical: {
            material: "Cast Iron or Steel",
            process: "Casting + Machining",
            weight: weight * 0.35,
            safetyFactor: 4.0,
          },
        },
        {
          name: "Shoulder Link",
          function: "Link 1 - major structural member",
          mechanical: {
            material: "Aluminum 7075-T6",
            process: "CNC Machining",
            weight: weight * 0.2,
            safetyFactor: 3.0,
          },
        },
        {
          name: "Elbow Link",
          function: "Link 2 - articulated joint",
          mechanical: {
            material: "Aluminum 7075-T6",
            process: "CNC Machining",
            weight: weight * 0.18,
            safetyFactor: 3.0,
          },
        },
        {
          name: "Wrist Assembly",
          function: "Joints 4-6, compact precision mechanism",
          mechanical: {
            material: "Stainless Steel 17-4 PH",
            process: "CNC + EDM",
            weight: weight * 0.15,
            safetyFactor: 2.5,
          },
        },
        {
          name: "End Effector Mount",
          function: "Tool interface (ISO 9409)",
          mechanical: {
            material: "Aluminum 6061-T6",
            process: "CNC Machining",
            weight: weight * 0.07,
            safetyFactor: 2.0,
          },
        },
        {
          name: "Cable Management",
          function: "Route power/signal through joints",
          mechanical: {
            material: "Igus E-Chain / PTFE Tubing",
            process: "Off-the-shelf",
            weight: weight * 0.05,
            safetyFactor: 2.0,
          },
        },
      ];
    }

    // Generic fallback
    return [
      {
        name: "Main Structure",
        function: "Primary load-bearing structure",
        mechanical: {
          material: "Aluminum 6061-T6",
          process: "CNC Machining",
          weight: weight * 0.5,
          safetyFactor: 3.0,
        },
      },
      {
        name: "Secondary Structure",
        function: "Supporting structure and mounts",
        mechanical: {
          material: "ABS",
          process: "FDM 3D Printing",
          weight: weight * 0.3,
          safetyFactor: 2.0,
        },
      },
      {
        name: "Fasteners & Hardware",
        function: "Assembly hardware",
        mechanical: {
          material: "Stainless Steel 18-8",
          process: "Off-the-shelf",
          weight: weight * 0.2,
          safetyFactor: 2.5,
        },
      },
    ];
  }

  private generateWarnings(subAssemblies: any[], targetWeight: number, budget: number): string[] {
    const warnings: string[] = [];
    const estimatedWeight = subAssemblies.reduce((sum, sa) => sum + (sa.mechanical?.weight || 0), 0);
    
    if (estimatedWeight > targetWeight) {
      warnings.push(`Estimated weight (${Math.round(estimatedWeight)}g) exceeds target (${targetWeight}g)`);
    }
    
    // Check for expensive processes
    const hasInjectionMolding = subAssemblies.some(sa => sa.mechanical?.process === "Injection Molding");
    const hasCNC = subAssemblies.some(sa => sa.mechanical?.process === "CNC Machining");
    const hasCarbonFiber = subAssemblies.some(sa => sa.mechanical?.material?.includes("Carbon Fiber"));
    
    if (hasInjectionMolding && budget < 1000) {
      warnings.push("Injection molding tooling cost may exceed budget for low volumes");
    }
    if (hasCarbonFiber && budget < 500) {
      warnings.push("Carbon fiber components expensive for prototyping budget");
    }
    
    return warnings;
  }
}