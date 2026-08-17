import { BaseAgent, AgentContext, AgentRunResult } from "./base-agent";
import { AgentType, AgentOutput, ProjectSpec } from "@/lib/types";
import { SYSTEM_PROMPTS } from "@/lib/nim";

export class ElectricalAgent extends BaseAgent {
  readonly type: AgentType = "ELECTRICAL";
  readonly systemPrompt = SYSTEM_PROMPTS.ELECTRICAL;

  async execute(context: AgentContext): Promise<AgentRunResult> {
    const startTime = Date.now();
    
    await this.emitAgentStart(context.designId);
    await this.updateAgentRun(context.designId, {
      status: "PROCESSING",
      startedAt: new Date(),
    });
    await this.log(context.designId, "Designing power systems and control architecture...");

    try {
      const output = await this.generateElectricalOutput(context);
      
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
      await this.log(context.designId, `Electrical design complete in ${duration}ms`, "info", {
        powerBudget: output.spec.powerBudget,
        voltage: output.spec.systemVoltage,
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
      await this.log(context.designId, `Electrical design failed: ${err.message}`, "error");
      
      throw error;
    }
  }

  private async generateElectricalOutput(context: AgentContext): Promise<AgentOutput> {
    const { prompt, constraints, previousOutputs } = context;
    const mechanicalOutput = previousOutputs.MECHANICAL?.spec as Record<string, unknown> | undefined;
    const orchestratorOutput = previousOutputs.ORCHESTRATOR?.spec as ProjectSpec | undefined;
    
    const productType = orchestratorOutput?.type || "device";
    const powerSource = constraints.powerSource || orchestratorOutput?.powerSource || "mains";
    const environment = constraints.environment || orchestratorOutput?.environment || "indoor";
    
    // Generate electrical architecture
    const { subAssemblies, powerBudget, systemVoltage, components } = this.generateElectricalArchitecture(
      productType,
      powerSource,
      environment,
      mechanicalOutput
    );
    
    const reasoning = `Designed electrical system for ${productType} with ${powerSource} power.
System voltage: ${systemVoltage}V. Total power budget: ${powerBudget}W.
Selected ${components.length} key components including motors, controllers, sensors, and protection.
Designed for ${environment} environment with appropriate IP rating.`;
    
    return {
      agent: "ELECTRICAL",
      status: "complete",
      spec: {
        subAssemblies: subAssemblies.map(sa => ({
          ...sa,
          electrical: sa.electrical,
        })),
        powerBudget,
        systemVoltage,
        components,
        wiringHarness: this.generateWiringHarness(subAssemblies),
        pcbRequirements: this.generatePCBRequirements(productType, components),
      },
      reasoning,
      confidence: 0.82,
      warnings: this.generateWarnings(powerBudget, powerSource, budget),
      nextAgentHints: [
        "Thermal agent should analyze heat from motor drivers and power electronics",
        "Mechanical agent should accommodate PCB mounting and connector clearance",
        "Manufacturing agent should plan for cable routing and strain relief",
      ],
    };
  }

  private generateElectricalArchitecture(
    productType: string,
    powerSource: string,
    environment: string,
    mechanicalOutput: Record<string, unknown> | undefined
  ) {
    const type = productType.toLowerCase();
    
    if (type.includes("fan")) {
      const motorPower = 45; // Watts for 400mm fan
      const systemVoltage = powerSource === "battery" ? 24 : 230;
      
      return {
        powerBudget: motorPower + 10, // Motor + controller overhead
        systemVoltage,
        subAssemblies: [
          {
            name: "Motor",
            function: "Drive fan blades",
            electrical: {
              voltage: systemVoltage === 230 ? 230 : 24,
              power: motorPower,
              current: systemVoltage === 230 ? 0.25 : 2.0,
              type: "BLDC",
            },
          },
          {
            name: "Motor Controller (ESC)",
            function: "Commutate BLDC motor, speed control",
            electrical: {
              voltage: systemVoltage,
              power: 5,
              current: 0.5,
              protocol: "PWM / UART",
            },
          },
          {
            name: "Power Supply",
            function: powerSource === "mains" ? "AC-DC conversion" : "Battery management",
            electrical: {
              voltage: systemVoltage,
              power: motorPower + 10,
              current: systemVoltage === 230 ? 0.3 : 3.0,
            },
          },
          {
            name: "Control Interface",
            function: "User interface, speed control, IoT connectivity",
            electrical: {
              voltage: 5,
              power: 2,
              current: 0.4,
              interfaces: ["WiFi", "Bluetooth", "Physical buttons"],
            },
          },
          {
            name: "Sensors",
            function: "RPM feedback, temperature, vibration",
            electrical: {
              voltage: 3.3,
              power: 0.5,
              current: 0.15,
              types: ["Hall effect", "Thermistor", "Accelerometer"],
            },
          },
        ],
        components: [
          { name: "BLDC Motor", spec: "45W, 24V/230V, 1500 RPM", qty: 1 },
          { name: "ESC", spec: "60A, BLHeli_32, PWM/UART", qty: 1 },
          { name: "MCU", spec: "ESP32-S3, WiFi/BT, 240MHz", qty: 1 },
          { name: "PSU", spec: powerSource === "mains" ? "Mean Well 60W 24V" : "4S Li-ion 14.8V 5Ah", qty: 1 },
          { name: "Hall Sensor", spec: "AH3503, 3.3V", qty: 1 },
          { name: "Thermistor", spec: "NTC 10k, 0603", qty: 2 },
        ],
      };
    }
    
    if (type.includes("drone")) {
      return {
        powerBudget: 800,
        systemVoltage: 22.2, // 6S LiPo
        subAssemblies: [
          {
            name: "Propulsion System (x4)",
            function: "Generate thrust",
            electrical: { voltage: 22.2, power: 180, current: 8.1, type: "BLDC Outrunner" },
          },
          {
            name: "ESCs (x4)",
            function: "Motor commutation",
            electrical: { voltage: 22.2, power: 10, current: 0.5, protocol: "DShot600" },
          },
          {
            name: "Flight Controller",
            function: "Stabilization, navigation",
            electrical: { voltage: 5, power: 2, current: 0.4, interfaces: ["SBUS", "CRSF", "GPS", "Telemetry"] },
          },
          {
            name: "Power Distribution",
            function: "Battery to ESC/FC distribution",
            electrical: { voltage: 22.2, power: 5, current: 0.2 },
          },
          {
            name: "Battery",
            function: "Energy storage",
            electrical: { voltage: 22.2, power: 800, current: 36, type: "6S 22.2V 5000mAh LiPo" },
          },
        ],
        components: [
          { name: "Motor", spec: "2207 1950KV, 6S", qty: 4 },
          { name: "ESC", spec: "BLHeli_32 45A 6S", qty: 4 },
          { name: "FC", spec: "STM32H7, ICM42688, BMP388", qty: 1 },
          { name: "Battery", spec: "6S 5000mAh 100C", qty: 1 },
          { name: "VTX", spec: "5.8GHz 800mW", qty: 1 },
          { name: "GPS", spec: "M10, Dual antenna", qty: 1 },
        ],
      };
    }
    
    if (type.includes("robotic_arm") || type.includes("arm")) {
      return {
        powerBudget: 500,
        systemVoltage: 48,
        subAssemblies: [
          {
            name: "Joint Motors (x6)",
            function: "Actuate each degree of freedom",
            electrical: { voltage: 48, power: 75, current: 1.6, type: "Servo / BLDC" },
          },
          {
            name: "Servo Drives (x6)",
            function: "Motor control, position/velocity/torque loops",
            electrical: { voltage: 48, power: 10, current: 0.3, protocol: "EtherCAT / CANopen" },
          },
          {
            name: "Robot Controller",
            function: "Trajectory planning, kinematics, I/O",
            electrical: { voltage: 24, power: 30, current: 1.25, interfaces: ["EtherCAT", "Ethernet", "Digital I/O", "Safety"] },
          },
          {
            name: "Power Supply",
            function: "AC-DC 48V supply",
            electrical: { voltage: 48, power: 500, current: 10.4 },
          },
          {
            name: "Force/Torque Sensor",
            function: "End effector force feedback",
            electrical: { voltage: 24, power: 2, current: 0.08, type: "6-axis F/T" },
          },
        ],
        components: [
          { name: "Servo Motor", spec: "750W, 48V, Brake, Encoder", qty: 6 },
          { name: "Servo Drive", spec: "1kW, EtherCAT, STO", qty: 6 },
          { name: "Controller", spec: "XMC4800 / LinuxCNC / ROS2", qty: 1 },
          { name: "PSU", spec: "48V 10A Industrial", qty: 1 },
          { name: "F/T Sensor", spec: "6-axis, 100N/10Nm", qty: 1 },
        ],
      };
    }

    // Generic fallback
    return {
      powerBudget: 100,
      systemVoltage: powerSource === "battery" ? 12 : 24,
      subAssemblies: [
        {
          name: "Main Actuator",
          function: "Primary motion",
          electrical: { voltage: 24, power: 50, current: 2.1, type: "DC Motor" },
        },
        {
          name: "Controller",
          function: "Control logic",
          electrical: { voltage: 5, power: 5, current: 1.0, interfaces: ["UART", "GPIO"] },
        },
        {
          name: "Power Supply",
          function: "Power conversion",
          electrical: { voltage: 24, power: 60, current: 2.5 },
        },
      ],
      components: [
        { name: "Motor", spec: "50W, 24V", qty: 1 },
        { name: "MCU", spec: "STM32G4, 170MHz", qty: 1 },
        { name: "Driver", spec: "DRV8874, 6A", qty: 1 },
        { name: "PSU", spec: "24V 3A", qty: 1 },
      ],
    };
  }

  private generateWiringHarness(subAssemblies: any[]) {
    return {
      mainPower: "14 AWG silicone wire, high temp",
      signal: "22 AWG twisted pair, shielded",
      connectors: ["XT60/XT90 (power)", "JST-GH (signal)", "M8/M12 (industrial)"],
      protection: "Braided sleeve, heat shrink, strain relief",
      estimatedLength: "2-5m depending on product size",
    };
  }

  private generatePCBRequirements(productType: string, components: any[]) {
    const hasHighPower = components.some(c => c.spec?.includes("A") && parseFloat(c.spec) > 5);
    
    return {
      layers: hasHighPower ? 4 : 2,
      material: "FR4 (TG170)" + (hasHighPower ? " with 2oz copper" : ""),
      dimensions: "Custom per enclosure",
      keyRequirements: [
        "Impedance control for high-speed signals",
        "Thermal vias under power components",
        "Creepage/clearance per IEC 60664",
        "Mounting holes aligned with mechanical",
        "Panelization for assembly",
      ],
      estimatedCost: hasHighPower ? "$25-50" : "$10-25",
    };
  }

  private generateWarnings(powerBudget: number, powerSource: string, budget: number): string[] {
    const warnings: string[] = [];
    
    if (powerBudget > 1000 && powerSource === "battery") {
      warnings.push("High power budget requires large/expensive battery");
    }
    
    if (budget < 200 && powerBudget > 50) {
      warnings.push("Electrical components may exceed budget");
    }
    
    return warnings;
  }
  
  // Need to access budget from context
  private budget = 500;
}