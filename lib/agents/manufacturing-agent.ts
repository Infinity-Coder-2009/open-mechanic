import { BaseAgent, AgentContext, AgentRunResult } from "./base-agent";
import { AgentType, AgentOutput, ProjectSpec } from "@/lib/types";
import { SYSTEM_PROMPTS } from "@/lib/nim";

export class ManufacturingAgent extends BaseAgent {
  readonly type: AgentType = "MANUFACTURING";
  readonly systemPrompt = SYSTEM_PROMPTS.MANUFACTURING;

  async execute(context: AgentContext): Promise<AgentRunResult> {
    const startTime = Date.now();
    
    await this.emitAgentStart(context.designId);
    await this.updateAgentRun(context.designId, {
      status: "PROCESSING",
      startedAt: new Date(),
    });
    await this.log(context.designId, "Analyzing DFM, tooling, and assembly sequence...");

    try {
      const output = await this.generateManufacturingOutput(context);
      
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
            await this.log(context.designId, `Manufacturing analysis complete in ${duration}ms`, "info", {
              processes: (output.spec as any).processes?.length,
              estimatedLeadTime: (output.spec as any).leadTime,
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
      await this.log(context.designId, `Manufacturing analysis failed: ${err.message}`, "error");
      
      throw error;
    }
  }

  private async generateManufacturingOutput(context: AgentContext): Promise<AgentOutput> {
    const { prompt, constraints, previousOutputs } = context;
    const mechanicalOutput = previousOutputs.MECHANICAL?.spec as Record<string, unknown> | undefined;
    const electricalOutput = previousOutputs.ELECTRICAL?.spec as Record<string, unknown> | undefined;
    const orchestratorOutput = previousOutputs.ORCHESTRATOR?.spec as ProjectSpec | undefined;
    
    const productType = orchestratorOutput?.type || "device";
    const budget = constraints.maxBudget || orchestratorOutput?.budget || 500;
    const volume = this.estimateVolume(budget, productType);
    
    // Analyze mechanical parts for DFM
    const dfmAnalysis = this.performDFMAnalysis(mechanicalOutput);
    
    // Determine tooling requirements
    const tooling = this.determineTooling(mechanicalOutput, volume);
    
    // Generate assembly sequence
    const assemblySequence = this.generateAssemblySequence(mechanicalOutput, electricalOutput);
    
    // Quality control plan
    const qcPlan = this.generateQCPlan(dfmAnalysis, assemblySequence);
    
    const reasoning = `Manufacturing analysis for ${productType} at ${volume} units/year.
Identified ${dfmAnalysis.issues.length} DFM issues. 
Tooling: ${tooling.molds} molds, ${tooling.fixtures} fixtures, ${tooling.jigs} jigs.
Assembly: ${assemblySequence.length} steps, estimated ${assemblySequence.reduce((sum, s) => sum + s.time, 0)} minutes.
Quality: ${qcPlan.checkpoints.length} inspection points.`;
    
    return {
      agent: "MANUFACTURING",
      status: "complete",
      spec: {
        dfmAnalysis,
        tooling,
        assemblySequence,
        qcPlan,
        leadTime: this.calculateLeadTime(tooling, volume),
        processes: this.extractProcesses(mechanicalOutput),
        volume,
        packaging: this.designPackaging(productType, mechanicalOutput),
      },
      reasoning,
      confidence: 0.8,
      warnings: this.generateWarnings(dfmAnalysis, tooling, budget),
      nextAgentHints: [
        "Cost agent should quote tooling amortization over production volume",
        "Mechanical agent should incorporate DFM feedback (draft angles, wall thickness)",
        "Electrical agent should standardize connectors for automated assembly",
      ],
    };
  }

  private estimateVolume(budget: number, productType: string): number {
    const type = productType.toLowerCase();
    if (type.includes("drone")) return budget > 1000 ? 1000 : 100;
    if (type.includes("robotic_arm")) return budget > 5000 ? 500 : 50;
    if (type.includes("fan")) return budget > 500 ? 5000 : 500;
    return budget > 1000 ? 1000 : 100;
  }

  private performDFMAnalysis(mechanicalOutput: Record<string, unknown> | undefined) {
    const issues: Array<{ severity: "error" | "warning" | "info"; message: string; part: string; recommendation: string }> = [];
    const suggestions: string[] = [];
    
    if (mechanicalOutput?.subAssemblies) {
      const subAssemblies = mechanicalOutput.subAssemblies as Array<{ name: string; mechanical: { process?: string; material?: string } }>;
      
      for (const sa of subAssemblies) {
        const process = sa.mechanical?.process;
        const material = sa.mechanical?.material;
        
        if (process === "Injection Molding") {
          issues.push({
            severity: "warning",
            message: "Injection molded parts need draft angles (1-2° minimum)",
            part: sa.name,
            recommendation: "Add draft to all vertical faces; verify wall thickness uniformity",
          });
          issues.push({
            severity: "warning",
            message: "Check for sink marks at thick sections",
            part: sa.name,
            recommendation: "Core out thick sections; maintain 2-3mm wall thickness",
          });
        }
        
        if (process === "CNC Machining") {
          issues.push({
            severity: "info",
            message: "Minimize setups - design for 3-axis where possible",
            part: sa.name,
            recommendation: "Avoid undercuts; use standard tool sizes; fillet internal corners",
          });
        }
        
        if (process === "FDM 3D Printing") {
          issues.push({
            severity: "warning",
            message: "FDM parts anisotropic - weaker in Z axis",
            part: sa.name,
            recommendation: "Orient print for load direction; add ribs for stiffness",
          });
          suggestions.push("Consider SLA/SLS for higher strength isotropic parts");
        }
        
        if (process === "Wire Forming + Welding") {
          issues.push({
            severity: "info",
            message: "Wire forms need stress relief after bending",
            part: sa.name,
            recommendation: "Specify stress relief heat treatment; design for welding access",
          });
        }
      }
    }
    
    return { issues, suggestions };
  }

  private determineTooling(mechanicalOutput: Record<string, unknown> | undefined, volume: number) {
    let molds = 0;
    let fixtures = 0;
    let jigs = 0;
    const details: string[] = [];
    
    if (mechanicalOutput?.subAssemblies) {
      const subAssemblies = mechanicalOutput.subAssemblies as Array<{ name: string; mechanical: { process?: string } }>;
      
      for (const sa of subAssemblies) {
        const process = sa.mechanical?.process;
        if (process === "Injection Molding") {
          molds++;
          details.push(`Mold for ${sa.name}: ${volume > 10000 ? "Multi-cavity hardened steel" : "Single cavity aluminum"}`);
        }
        if (process === "CNC Machining") {
          fixtures++;
          details.push(`Fixture for ${sa.name}: ${volume > 1000 ? "Modular vacuum fixture" : "Custom soft jaw"}`);
        }
        if (process === "Wire Forming + Welding") {
          jigs++;
          details.push(`Welding jig for ${sa.name}: Locating pins + clamps`);
        }
      }
    }
    
    // Assembly fixtures
    fixtures += 2; // Base assembly + final test fixture
    details.push("Final assembly fixture: Poka-yoke alignment");
    details.push("Functional test fixture: Electrical + mechanical verification");
    
    return { molds, fixtures, jigs, details, estimatedCost: molds * 3000 + fixtures * 500 + jigs * 300 };
  }

  private generateAssemblySequence(mechanicalOutput: Record<string, unknown> | undefined, electricalOutput: Record<string, unknown> | undefined) {
    const steps: Array<{ step: number; name: string; description: string; time: number; tools: string[]; pokaYoke: string }> = [];
    let stepNum = 1;
    
    if (mechanicalOutput?.subAssemblies) {
      const subAssemblies = mechanicalOutput.subAssemblies as Array<{ name: string; mechanical: { process?: string } }>;
      
      // Sub-assembly builds
      for (const sa of subAssemblies) {
        if (sa.mechanical?.process === "Injection Molding" || sa.mechanical?.process === "CNC Machining") {
          steps.push({
            step: stepNum++,
            name: `Sub-assembly: ${sa.name}`,
            description: `Assemble ${sa.name} components`,
            time: 5,
            tools: ["Torque wrench", "Fixture"],
            pokaYoke: "Keyed features prevent misassembly",
          });
        }
      }
      
      // Main assembly
      steps.push({
        step: stepNum++,
        name: "Main Frame Assembly",
        description: "Assemble structural frame",
        time: 10,
        tools: ["Torque wrench", "Allen keys", "Fixture"],
        pokaYoke: "Asymmetric mounting holes",
      });
      
      // Motor/actuator installation
      steps.push({
        step: stepNum++,
        name: "Motor Installation",
        description: "Mount motor(s) to frame",
        time: 8,
        tools: ["Torque wrench", "Thread locker"],
        pokaYoke: "Motor only fits one orientation",
      });
      
      // Electrical integration
      if (electricalOutput?.subAssemblies) {
        steps.push({
          step: stepNum++,
          name: "PCB Installation",
          description: "Mount PCB, connect harness",
          time: 12,
          tools: ["Screwdriver", "Crimp tool", "Multimeter"],
          pokaYoke: "Keyed connectors, color-coded wires",
        });
        
        steps.push({
          step: stepNum++,
          name: "Wiring Harness Routing",
          description: "Route and secure wiring",
          time: 10,
          tools: ["Cable ties", "Heat gun", "Labels"],
          pokaYoke: "Length-specific harnesses",
        });
      }
      
      // Final assembly
      steps.push({
        step: stepNum++,
        name: "Enclosure/Guard Assembly",
        description: "Attach covers, guards, external parts",
        time: 8,
        tools: ["Screwdriver", "Torque wrench"],
        pokaYoke: "Captive screws, alignment pins",
      });
      
      // Test
      steps.push({
        step: stepNum++,
        name: "Functional Test",
        description: "Power on, verify operation, record data",
        time: 15,
        tools: ["Test fixture", "Oscilloscope", "Tachometer", "Thermocouple"],
        pokaYoke: "Automated PASS/FAIL with data logging",
      });
    }
    
    return steps;
  }

  private generateQCPlan(dfmAnalysis: any, assemblySequence: any[]) {
    const checkpoints: Array<{ step: number; name: string; type: "dimensional" | "visual" | "functional" | "electrical"; spec: string; method: string; frequency: string }> = [];
    
    // Incoming inspection
    checkpoints.push({
      step: 0,
      name: "Incoming Material Inspection",
      type: "dimensional",
      spec: "Material certs, dimensional sampling",
      method: "CMM / Calipers / Visual",
      frequency: "Per lot",
    });
    
    // First article inspection
    checkpoints.push({
      step: 0,
      name: "First Article Inspection (FAI)",
      type: "dimensional",
      spec: "Full dimensional per AS9102",
      method: "CMM + Optical",
      frequency: "First article only",
    });
    
    // In-process
    for (const step of assemblySequence) {
      if (step.pokaYoke) {
        checkpoints.push({
          step: step.step,
          name: `In-Process: ${step.name}`,
          type: "visual",
          spec: step.pokaYoke,
          method: "Visual verification",
          frequency: "Every unit",
        });
      }
    }
    
    // Final test
    checkpoints.push({
      step: assemblySequence.length + 1,
      name: "Final Functional Test",
      type: "functional",
      spec: "Performance per spec sheet",
      method: "Automated test fixture",
      frequency: "Every unit",
    });
    
    return { checkpoints, samplingPlan: "AQL 1.0 / 1.5 per ISO 2859" };
  }

  private calculateLeadTime(tooling: any, volume: number): string {
    const moldTime = tooling.molds > 0 ? (volume > 10000 ? 6 : 3) : 0;
    const fixtureTime = tooling.fixtures > 0 ? 2 : 0;
    const setupTime = 1;
    return `${moldTime + fixtureTime + setupTime} weeks`;
  }

  private extractProcesses(mechanicalOutput: Record<string, unknown> | undefined) {
    const processes = new Set<string>();
    if (mechanicalOutput?.subAssemblies) {
      const subAssemblies = mechanicalOutput.subAssemblies as Array<{ mechanical: { process?: string } }>;
      for (const sa of subAssemblies) {
        if (sa.mechanical?.process) processes.add(sa.mechanical.process);
      }
    }
    return Array.from(processes);
  }

  private designPackaging(productType: string, mechanicalOutput: Record<string, unknown> | undefined) {
    return {
      type: productType.includes("drone") ? "Custom foam insert + corrugated box" : "Corrugated box with inserts",
      dims: "Per product + 50mm clearance",
      protection: "ESD bag + foam corners",
      labeling: "Barcode, serial, compliance marks",
      estimatedCost: productType.includes("drone") ? 15 : 8,
    };
  }

  private generateWarnings(dfmAnalysis: any, tooling: any, budget: number): string[] {
    const warnings: string[] = [];
    
    if (dfmAnalysis.issues.some((i: any) => i.severity === "error")) {
      warnings.push("Critical DFM errors found - redesign required before production");
    }
    
    if (tooling.estimatedCost > budget * 0.5) {
      warnings.push(`Tooling cost ($${tooling.estimatedCost}) exceeds 50% of budget - consider process change`);
    }
    
    if (tooling.molds > 0 && budget < 2000) {
      warnings.push("Injection molding tooling may not be cost-effective at this budget");
    }
    
    return warnings;
  }
}