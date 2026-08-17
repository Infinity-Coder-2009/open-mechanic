import { BaseAgent, AgentContext, AgentRunResult } from "./base-agent";
import { AgentType, AgentOutput, ProjectSpec } from "@/lib/types";
import { SYSTEM_PROMPTS } from "@/lib/nim";

export class ThermalAgent extends BaseAgent {
  readonly type: AgentType = "THERMAL";
  readonly systemPrompt = SYSTEM_PROMPTS.THERMAL;

  async execute(context: AgentContext): Promise<AgentRunResult> {
    const startTime = Date.now();
    
    await this.emitAgentStart(context.designId);
    await this.updateAgentRun(context.designId, {
      status: "PROCESSING",
      startedAt: new Date(),
    });
    await this.log(context.designId, "Performing thermal analysis and cooling design...");

    try {
      const output = await this.generateThermalOutput(context);
      
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
      await this.log(context.designId, `Thermal analysis complete in ${duration}ms`, "info", {
        maxTemp: output.spec.maxTemperature,
        coolingMethod: output.spec.coolingMethod,
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
      await this.log(context.designId, `Thermal analysis failed: ${err.message}`, "error");
      
      throw error;
    }
  }

  private async generateThermalOutput(context: AgentContext): Promise<AgentOutput> {
    const { prompt, constraints, previousOutputs } = context;
    const mechanicalOutput = previousOutputs.MECHANICAL?.spec as Record<string, unknown> | undefined;
    const electricalOutput = previousOutputs.ELECTRICAL?.spec as Record<string, unknown> | undefined;
    const orchestratorOutput = previousOutputs.ORCHESTRATOR?.spec as ProjectSpec | undefined;
    
    const productType = orchestratorOutput?.type || "device";
    const environment = constraints.environment || orchestratorOutput?.environment || "indoor";
    const powerBudget = (electricalOutput?.powerBudget as number) || 100;
    
    // Estimate heat sources
    const heatSources = this.identifyHeatSources(electricalOutput, mechanicalOutput);
    const totalHeatLoad = heatSources.reduce((sum, hs) => sum + hs.power, 0);
    
    // Determine cooling strategy
    const coolingStrategy = this.determineCoolingStrategy(productType, totalHeatLoad, environment);
    
    // Calculate thermal resistance requirements
    const maxAmbient = this.getMaxAmbient(environment);
    const maxJunctionTemp = 85; // °C for most electronics
    const requiredThermalResistance = (maxJunctionTemp - maxAmbient) / totalHeatLoad;
    
    const reasoning = `Thermal analysis for ${productType} in ${environment} environment.
Total heat load: ${totalHeatLoad.toFixed(1)}W from ${heatSources.length} sources.
Max ambient: ${maxAmbient}°C. Required thermal resistance: ${requiredThermalResistance.toFixed(2)}°C/W.
Selected cooling: ${coolingStrategy.method}.`;
    
    return {
      agent: "THERMAL",
      status: "complete",
      spec: {
        subAssemblies: this.generateThermalSubAssemblies(heatSources, coolingStrategy),
        totalHeatLoad,
        maxTemperature: maxJunctionTemp,
        maxAmbientTemp: maxAmbient,
        requiredThermalResistance,
        coolingMethod: coolingStrategy.method,
        coolingDetails: coolingStrategy.details,
        simulationRequired: coolingStrategy.simulationRequired,
      },
      reasoning,
      confidence: 0.75,
      warnings: this.generateWarnings(totalHeatLoad, requiredThermalResistance, coolingStrategy),
      nextAgentHints: [
        "Mechanical agent should integrate heat sink mounting features",
        "Manufacturing agent should validate thermal interface material application",
        "CFD simulation recommended for forced convection designs",
      ],
    };
  }

  private identifyHeatSources(electricalOutput: Record<string, unknown> | undefined, mechanicalOutput: Record<string, unknown> | undefined) {
    const sources: Array<{ name: string; power: number; component: string; location: string }> = [];
    
    if (electricalOutput?.components) {
      const components = electricalOutput.components as Array<{ name: string; spec: string; qty: number }>;
      for (const comp of components) {
        if (comp.name.includes("Motor") || comp.name.includes("ESC") || comp.name.includes("Drive")) {
          const powerMatch = comp.spec.match(/(\d+)W/);
          const power = powerMatch ? parseInt(powerMatch[1]) * 0.15 : 10; // 15% efficiency loss as heat
          sources.push({
            name: comp.name,
            power,
            component: comp.name,
            location: "Motor mount / PCB",
          });
        }
        if (comp.name.includes("PSU") || comp.name.includes("Power Supply")) {
          const powerMatch = comp.spec.match(/(\d+)W/);
          const power = powerMatch ? parseInt(powerMatch[1]) * 0.1 : 5; // 10% loss
          sources.push({
            name: comp.name,
            power,
            component: comp.name,
            location: "Enclosure",
          });
        }
        if (comp.name.includes("MCU") || comp.name.includes("Controller")) {
          sources.push({
            name: comp.name,
            power: 1.5,
            component: comp.name,
            location: "PCB",
          });
        }
      }
    }
    
    // Mechanical friction heat
    if (mechanicalOutput?.subAssemblies) {
      const subAssemblies = mechanicalOutput.subAssemblies as Array<{ name: string; mechanical: { weight?: number } }>;
      for (const sa of subAssemblies) {
        if (sa.name.includes("Motor") || sa.name.includes("Bearing") || sa.name.includes("Gear")) {
          sources.push({
            name: `${sa.name} Friction`,
            power: 2.0,
            component: sa.name,
            location: sa.name,
          });
        }
      }
    }
    
    return sources.length > 0 ? sources : [
      { name: "Electronics", power: 10, component: "PCB", location: "Enclosure" },
      { name: "Motor", power: 15, component: "Motor", location: "Motor mount" },
    ];
  }

  private determineCoolingStrategy(productType: string, heatLoad: number, environment: string) {
    const type = productType.toLowerCase();
    
    if (type.includes("fan")) {
      return {
        method: "Forced Air (Self-cooling)",
        details: "Fan blades provide airflow over motor and ESC. Motor mounted in airflow path.",
        simulationRequired: false,
      };
    }
    
    if (type.includes("drone")) {
      return {
        method: "Forced Air (Prop Wash)",
        details: "Propeller downwash cools ESCs and motors. ESC mounted in propeller airflow.",
        simulationRequired: false,
      };
    }
    
    if (type.includes("robotic_arm") || type.includes("arm")) {
      if (heatLoad > 100) {
        return {
          method: "Liquid Cooling",
          details: "Water/glycol loop through motor housings and drive heat sinks. External radiator.",
          simulationRequired: true,
        };
      }
      return {
        method: "Forced Air + Heat Sinks",
        details: "Fin heat sinks on drives, ducted fan in base. Thermal pads on motor stators.",
        simulationRequired: true,
      };
    }
    
    // Generic
    if (heatLoad > 50) {
      return {
        method: "Forced Air + Heat Sinks",
        details: "Extruded aluminum heat sinks with 40mm PWM fan. Thermal interface: phase change pad.",
        simulationRequired: true,
      };
    }
    
    return {
      method: "Natural Convection",
      details: "Enclosure with ventilation slots. Thermal pad to metal chassis.",
      simulationRequired: false,
    };
  }

  private getMaxAmbient(environment: string): number {
    switch (environment) {
      case "industrial": return 55;
      case "outdoor": return 45;
      case "space": return 40; // Vacuum - no convection, only radiation
      default: return 35; // indoor
    }
  }

  private generateThermalSubAssemblies(heatSources: any[], coolingStrategy: any) {
    return heatSources.map(hs => ({
      name: hs.name,
      function: `Thermal management for ${hs.component}`,
      thermal: {
        heatLoad: hs.power,
        maxTemp: 85,
        cooling: coolingStrategy.method,
        thermalResistance: 0.5, // °C/W target
        interfaceMaterial: "Phase change pad / Thermal grease",
      },
    }));
  }

  private generateWarnings(heatLoad: number, thermalResistance: number, coolingStrategy: any): string[] {
    const warnings: string[] = [];
    
    if (thermalResistance < 0.5) {
      warnings.push(`Very low thermal resistance required (${thermalResistance.toFixed(2)}°C/W) - may need liquid cooling`);
    }
    
    if (coolingStrategy.simulationRequired) {
      warnings.push("CFD/FEA thermal simulation recommended to validate cooling design");
    }
    
    if (heatLoad > 200) {
      warnings.push("High heat load - consider splitting power electronics across multiple zones");
    }
    
    return warnings;
  }
}