import { BaseAgent, AgentContext, AgentRunResult } from "./base-agent";
import { AgentType, AgentOutput, ProjectSpec } from "@/lib/types";
import { SYSTEM_PROMPTS } from "@/lib/nim";

export class CostAgent extends BaseAgent {
  readonly type: AgentType = "COST";
  readonly systemPrompt = SYSTEM_PROMPTS.COST;

  async execute(context: AgentContext): Promise<AgentRunResult> {
    const startTime = Date.now();
    
    await this.emitAgentStart(context.designId);
    await this.updateAgentRun(context.designId, {
      status: "PROCESSING",
      startedAt: new Date(),
    });
    await this.log(context.designId, "Calculating BOM costs and supplier pricing...");

    try {
      const output = await this.generateCostOutput(context);
      
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
      await this.log(context.designId, `Cost analysis complete in ${duration}ms`, "info", {
        totalCost: output.spec.totalCost,
        budgetCompliance: output.spec.budgetCompliance,
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
      await this.log(context.designId, `Cost analysis failed: ${err.message}`, "error");
      
      throw error;
    }
  }

  private async generateCostOutput(context: AgentContext): Promise<AgentOutput> {
    const { prompt, constraints, previousOutputs } = context;
    const mechanicalOutput = previousOutputs.MECHANICAL?.spec as Record<string, unknown> | undefined;
    const electricalOutput = previousOutputs.ELECTRICAL?.spec as Record<string, unknown> | undefined;
    const manufacturingOutput = previousOutputs.MANUFACTURING?.spec as Record<string, unknown> | undefined;
    const orchestratorOutput = previousOutputs.ORCHESTRATOR?.spec as ProjectSpec | undefined;
    
    const productType = orchestratorOutput?.type || "device";
    const budget = constraints.maxBudget || orchestratorOutput?.budget || 500;
    const volume = manufacturingOutput?.volume as number || 100;
    
    // Build BOM from all agent outputs
    const bom = this.buildBOM(mechanicalOutput, electricalOutput, manufacturingOutput, volume);
    
    // Calculate costs
    const { totalCost, breakdown, supplierQuotes } = this.calculateCosts(bom, volume);
    
    // Budget compliance
    const budgetCompliance = {
      withinBudget: totalCost <= budget,
      percentOfBudget: (totalCost / budget * 100).toFixed(1),
      variance: totalCost - budget,
    };
    
    // Cost reduction opportunities
    const reductions = this.identifyReductions(bom, breakdown);
    
    const reasoning = `Cost analysis for ${productType} at ${volume} units/year.
BOM: ${bom.items.length} line items.
Total estimated cost: $${totalCost.toFixed(2)} (${budgetCompliance.percentOfBudget}% of $${budget} budget).
Tooling amortized: $${breakdown.tooling.toFixed(2)}/unit.
Identified ${reductions.length} cost reduction opportunities.`;
    
    return {
      agent: "COST",
      status: "complete",
      spec: {
        bom: bom.items,
        totalCost,
        breakdown,
        supplierQuotes,
        budgetCompliance,
        reductions,
        volumePricing: this.calculateVolumePricing(bom),
        leadTimes: this.getLeadTimes(bom),
      },
      reasoning,
      confidence: 0.78,
      warnings: this.generateWarnings(totalCost, budget, budgetCompliance, reductions),
      nextAgentHints: [
        "Orchestrator should flag budget overruns for human review",
        "Mechanical agent should evaluate cheaper material alternatives",
        "Manufacturing agent should assess process changes for volume pricing",
      ],
    };
  }

  private buildBOM(
    mechanicalOutput: Record<string, unknown> | undefined,
    electricalOutput: Record<string, unknown> | undefined,
    manufacturingOutput: Record<string, unknown> | undefined,
    volume: number
  ) {
    const items: Array<{
      partNumber: string;
      description: string;
      category: string;
      qty: number;
      unitCost: number;
      totalCost: number;
      supplier: string;
      supplierPN: string;
      leadTime: string;
      notes: string;
    }> = [];
    
    let pnCounter = 1;
    
    // Mechanical parts
    if (mechanicalOutput?.subAssemblies) {
      const subAssemblies = mechanicalOutput.subAssemblies as Array<{ name: string; mechanical: { material?: string; process?: string; weight?: number } }>;
      for (const sa of subAssemblies) {
        const cost = this.estimateMechanicalCost(sa);
        items.push({
          partNumber: `MECH-${pnCounter++}`,
          description: `${sa.name} - ${sa.mechanical?.material} (${sa.mechanical?.process})`,
          category: "Mechanical",
          qty: 1,
          unitCost: cost,
          totalCost: cost,
          supplier: this.getMechanicalSupplier(sa.mechanical?.process),
          supplierPN: "CUSTOM",
          leadTime: this.getMechanicalLeadTime(sa.mechanical?.process, volume),
          notes: `Weight: ${sa.mechanical?.weight}g`,
        });
      }
    }
    
    // Electrical components
    if (electricalOutput?.components) {
      const components = electricalOutput.components as Array<{ name: string; spec: string; qty: number }>;
      for (const comp of components) {
        const cost = this.estimateElectricalCost(comp);
        items.push({
          partNumber: `ELEC-${pnCounter++}`,
          description: `${comp.name} - ${comp.spec}`,
          category: "Electrical",
          qty: comp.qty,
          unitCost: cost,
          totalCost: cost * comp.qty,
          supplier: this.getElectricalSupplier(comp.name),
          supplierPN: this.getSupplierPN(comp.name),
          leadTime: this.getElectricalLeadTime(comp.name),
          notes: comp.spec,
        });
      }
    }
    
    // Fasteners & hardware (estimated)
    items.push({
      partNumber: `HW-${pnCounter++}`,
      description: "Fasteners, standoffs, cable ties, heat shrink",
      category: "Hardware",
      qty: 1,
      unitCost: 15,
      totalCost: 15,
      supplier: "McMaster-Carr",
      supplierPN: "KIT-FASTENER-MISC",
      leadTime: "1-2 days",
      notes: "Assorted M3-M5 hardware",
    });
    
    // Assembly labor
    const assemblyTime = manufacturingOutput?.assemblySequence 
      ? (manufacturingOutput.assemblySequence as Array<{ time: number }>).reduce((sum, s) => sum + s.time, 0)
      : 60;
    const laborRate = 50; // $/hour
    items.push({
      partNumber: `LAB-${pnCounter++}`,
      description: "Assembly & test labor",
      category: "Labor",
      qty: 1,
      unitCost: (assemblyTime / 60) * laborRate,
      totalCost: (assemblyTime / 60) * laborRate,
      supplier: "Internal",
      supplierPN: "LABOR-ASSEMBLY",
      leadTime: "N/A",
      notes: `${assemblyTime} min @ $${laborRate}/hr`,
    });
    
    // Packaging
    items.push({
      partNumber: `PKG-${pnCounter++}`,
      description: "Packaging materials",
      category: "Packaging",
      qty: 1,
      unitCost: manufacturingOutput?.packaging?.estimatedCost || 10,
      totalCost: manufacturingOutput?.packaging?.estimatedCost || 10,
      supplier: "Uline",
      supplierPN: "PKG-CUSTOM",
      leadTime: "1 week",
      notes: manufacturingOutput?.packaging?.type || "Standard box",
    });
    
    return { items };
  }

  private estimateMechanicalCost(sa: { name: string; mechanical: { material?: string; process?: string; weight?: number } }): number {
    const { material, process, weight = 100 } = sa.mechanical;
    const w_kg = weight / 1000;
    
    const materialCosts: Record<string, number> = {
      "Aluminum 6061-T6": 8,
      "Aluminum 7075-T6": 12,
      "Stainless Steel 17-4 PH": 18,
      "Stainless Steel 304": 6,
      "Carbon Fiber Composite": 45,
      "Carbon Fiber Tube": 35,
      "Nylon 6/6 (PA66) 30% Glass Filled": 6,
      "ABS": 3,
      "PETG": 4,
      "TPU 95A": 8,
      "Powder Coated Steel Wire": 4,
      "Cast Iron": 3,
    };
    
    const processMultipliers: Record<string, number> = {
      "CNC Machining": 2.5,
      "Injection Molding": 0.8, // Amortized
      "FDM 3D Printing": 0.5,
      "Wire Forming + Welding": 1.5,
      "Casting + Machining": 2.0,
      "Pultrusion + Machining": 1.8,
      "CNC + EDM": 3.0,
      "Off-the-shelf": 1.0,
    };
    
    const matCost = materialCosts[material || "Aluminum 6061-T6"] || 8;
    const procMult = processMultipliers[process || "CNC Machining"] || 2.0;
    
    return Math.round(matCost * w_kg * procMult * 100) / 100;
  }

  private estimateElectricalCost(comp: { name: string; spec: string }): number {
    const costs: Record<string, number> = {
      "BLDC Motor": 45,
      "ESC": 25,
      "MCU": 8,
      "PSU": 35,
      "Hall Sensor": 2,
      "Thermistor": 0.5,
      "Motor": 60,
      "Servo Motor": 180,
      "Servo Drive": 220,
      "Controller": 150,
      "F/T Sensor": 800,
      "VTX": 40,
      "GPS": 25,
      "Battery": 80,
      "Driver": 12,
    };
    
    return costs[comp.name] || 20;
  }

  private calculateCosts(bom: { items: any[] }, volume: number) {
    const breakdown = {
      materials: 0,
      electrical: 0,
      hardware: 0,
      labor: 0,
      packaging: 0,
      tooling: 0,
      overhead: 0,
    };
    
    const supplierQuotes: Record<string, { supplier: string; unitPrice: number; moq: number; leadTime: string }> = {};
    
    for (const item of bom.items) {
      breakdown[item.category.toLowerCase() as keyof typeof breakdown] += item.totalCost;
      
      if (!supplierQuotes[item.supplier]) {
        supplierQuotes[item.supplier] = {
          supplier: item.supplier,
          unitPrice: 0,
          moq: 1,
          leadTime: item.leadTime,
        };
      }
      supplierQuotes[item.supplier].unitPrice += item.totalCost;
    }
    
    // Tooling amortization
    const manufacturingTooling = 5000; // Estimate
    breakdown.tooling = manufacturingTooling / Math.max(volume, 1);
    
    // Overhead (20%)
    const subtotal = Object.values(breakdown).reduce((a, b) => a + b, 0);
    breakdown.overhead = subtotal * 0.2;
    
    const totalCost = subtotal + breakdown.overhead;
    
    return { totalCost, breakdown, supplierQuotes };
  }

  private identifyReductions(bom: { items: any[] }, breakdown: any) {
    const reductions: Array<{ description: string; savings: string; effort: "low" | "medium" | "high"; risk: "low" | "medium" | "high" }> = [];
    
    if (breakdown.materials > 50) {
      reductions.push({
        description: "Switch from CNC aluminum to sheet metal + bend for non-critical brackets",
        savings: `$${(breakdown.materials * 0.3).toFixed(0)}/unit`,
        effort: "medium",
        risk: "low",
      });
    }
    
    if (breakdown.electrical > 100) {
      reductions.push({
        description: "Use integrated motor+driver instead of separate components",
        savings: `$${(breakdown.electrical * 0.15).toFixed(0)}/unit`,
        effort: "high",
        risk: "medium",
      });
    }
    
    if (breakdown.labor > 30) {
      reductions.push({
        description: "Design for automated assembly (self-locating features, DFA)",
        savings: `$${(breakdown.labor * 0.25).toFixed(0)}/unit`,
        effort: "high",
        risk: "low",
      });
    }
    
    reductions.push({
      description: "Consolidate fasteners - use fewer sizes, prefer captive hardware",
      savings: "$3-5/unit",
      effort: "low",
      risk: "low",
    });
    
    return reductions;
  }

  private calculateVolumePricing(bom: { items: any[] }) {
    const volumes = [1, 10, 100, 1000, 10000];
    return volumes.map(v => ({
      volume: v,
      unitCost: bom.items.reduce((sum, item) => {
        const volDiscount = v >= 1000 ? 0.7 : v >= 100 ? 0.85 : v >= 10 ? 0.95 : 1.0;
        return sum + item.unitCost * volDiscount * item.qty;
      }, 0),
    }));
  }

  private getLeadTimes(bom: { items: any[] }) {
    const leadTimes: Record<string, string> = {};
    for (const item of bom.items) {
      leadTimes[item.partNumber] = item.leadTime;
    }
    return leadTimes;
  }

  private getMechanicalSupplier(process?: string): string {
    switch (process) {
      case "CNC Machining": return "Xometry / Protolabs / Local Job Shop";
      case "Injection Molding": return "Xometry / Protolabs / ICO Mold";
      case "FDM 3D Printing": return "Print farm / Internal";
      case "Wire Forming + Welding": return "Local fabrication shop";
      case "Casting + Machining": return "Foundry + Machine shop";
      default: return "Xometry / Protolabs";
    }
  }

  private getMechanicalLeadTime(process?: string, volume: number = 100): string {
    switch (process) {
      case "CNC Machining": return volume > 100 ? "2-3 weeks" : "5-10 days";
      case "Injection Molding": return volume > 10000 ? "6-8 weeks" : "3-4 weeks";
      case "FDM 3D Printing": return "2-5 days";
      case "Wire Forming + Welding": return "1-2 weeks";
      default: return "2-3 weeks";
    }
  }

  private getElectricalSupplier(name: string): string {
    const suppliers: Record<string, string> = {
      "BLDC Motor": "DigiKey / Mouser / T-Motor",
      "ESC": "DigiKey / Mouser / Hobbywing",
      "MCU": "DigiKey / Mouser / LCSC",
      "PSU": "DigiKey / Mouser / Mean Well",
      "Hall Sensor": "DigiKey / Mouser / LCSC",
      "Thermistor": "DigiKey / Mouser / LCSC",
      "Servo Motor": "DigiKey / Mouser / Delta / Yaskawa",
      "Servo Drive": "DigiKey / Mouser / Delta / Yaskawa",
      "Controller": "DigiKey / Mouser / Beckhoff",
      "F/T Sensor": "ATI / Schunk / OnRobot",
      "VTX": "DigiKey / Mouser / TBS",
      "GPS": "DigiKey / Mouser / Holybro",
      "Battery": "Tattu / Gens Ace / Local",
      "Driver": "DigiKey / Mouser / LCSC",
    };
    return suppliers[name] || "DigiKey / Mouser";
  }

  private getSupplierPN(name: string): string {
    const pns: Record<string, string> = {
      "BLDC Motor": "T-MOTOR-MN4014",
      "ESC": "HOBBYWING-XROTOR-60A",
      "MCU": "ESP32-S3-WROOM-1",
      "PSU": "MWR-GSM60B24",
      "Hall Sensor": "AH3503-SA",
      "Thermistor": "NTC-10K-0603",
      "Servo Motor": "DELTA-ASDA-B3",
      "Servo Drive": "DELTA-ASD-B3-07",
      "Controller": "BECKHOFF-CX5240",
      "F/T Sensor": "ATI-AXIA-80",
      "VTX": "TBS-UNIFY-PRO32",
      "GPS": "HOLYBRO-M10",
      "Battery": "TATTU-6S-5000",
      "Driver": "DRV8874-Q1",
    };
    return pns[name] || "TBD";
  }

  private getElectricalLeadTime(name: string): string {
    const times: Record<string, string> = {
      "BLDC Motor": "1-2 weeks",
      "ESC": "1 week",
      "MCU": "1-2 weeks",
      "PSU": "1 week",
      "Hall Sensor": "1 week",
      "Thermistor": "1 week",
      "Servo Motor": "2-4 weeks",
      "Servo Drive": "2-4 weeks",
      "Controller": "2-4 weeks",
      "F/T Sensor": "4-6 weeks",
      "VTX": "1 week",
      "GPS": "1-2 weeks",
      "Battery": "1-2 weeks",
      "Driver": "1 week",
    };
    return times[name] || "1-2 weeks";
  }

  private generateWarnings(totalCost: number, budget: number, budgetCompliance: any, reductions: any[]): string[] {
    const warnings: string[] = [];
    
    if (!budgetCompliance.withinBudget) {
      warnings.push(`OVER BUDGET: $${totalCost.toFixed(2)} vs $${budget} budget (${budgetCompliance.percentOfBudget}%)`);
      warnings.push(`${reductions.length} cost reduction opportunities identified`);
    } else if (budgetCompliance.percentOfBudget > 80) {
      warnings.push(`Approaching budget limit (${budgetCompliance.percentOfBudget}%)`);
    }
    
    if (budgetCompliance.percentOfBudget > 120) {
      warnings.push("Significant redesign required to meet budget");
    }
    
    return warnings;
  }
}