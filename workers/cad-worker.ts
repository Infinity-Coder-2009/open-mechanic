import { Worker } from "bullmq";
import { spawn } from "child_process";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/queue";
import { CadJobData } from "@/lib/types";
import { logToDesign, emitJobUpdate } from "./shared/logger";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

console.log("Starting CAD Worker...");

const worker = new Worker<CadJobData>(
  "cad",
  async (job) => {
    const { designId, spec } = job.data;
    
    await logToDesign(designId, "CAD worker started", "info", "CAD");
    
    // Update design status
    await prisma.design.update({
      where: { id: designId },
      data: { status: "CAD_GENERATING" },
    });

    await emitJobUpdate(designId, 0, "Preparing CAD generation...", "CAD");

    try {
      // Create output directory
      const outputDir = join(process.cwd(), "output", designId);
      if (!existsSync(outputDir)) {
        mkdirSync(outputDir, { recursive: true });
      }

      // Prepare input for Python CAD service
      const inputParams = extractFanParameters(spec);
      const inputPath = join(outputDir, "input.json");
      writeFileSync(inputPath, JSON.stringify(inputParams, null, 2));

      await emitJobUpdate(designId, 20, "Calling Python CAD service...", "CAD");
      await logToDesign(designId, `Generating CAD for ${spec.type}`, "info", "CAD", inputParams);

      // Call Python CAD microservice
      const stlPath = await callPythonCadService(inputPath, outputDir, designId);

      await emitJobUpdate(designId, 80, "CAD generation complete, validating output...", "CAD");

      // Verify STL file exists
      const { existsSync: checkExists } = await import("fs");
      if (!checkExists(stlPath)) {
        throw new Error("STL file not generated");
      }

      // Get file size
      const { statSync } = await import("fs");
      const stats = statSync(stlPath);
      
      await emitJobUpdate(designId, 100, "CAD generation complete", "CAD");
      await logToDesign(designId, `CAD generated: ${stlPath} (${stats.size} bytes)`, "info", "CAD");

      // Update design with CAD result
      await prisma.design.update({
        where: { id: designId },
        data: { 
          status: "SIMULATING",
        },
      });

      // Return result for next stage
      return { 
        success: true, 
        stlPath,
        fileSize: stats.size,
        inputParams,
      };
    } catch (error) {
      const err = error as Error;
      await logToDesign(designId, `CAD generation failed: ${err.message}`, "error", "CAD");
      
      await prisma.design.update({
        where: { id: designId },
        data: { status: "FAILED" },
      });
      
      throw error;
    }
  },
  {
    connection: redis,
    concurrency: 1, // CAD generation is resource intensive
  }
);

function extractFanParameters(spec: any) {
  // Extract fan-specific parameters from spec
  const subAssemblies = spec.subAssemblies || [];
  const fanSubAssembly = subAssemblies.find((sa: any) => 
    sa.name.toLowerCase().includes("fan") || 
    sa.name.toLowerCase().includes("blade") ||
    sa.name.toLowerCase().includes("hub")
  );

  // Default parameters for a 400mm wall fan
  return {
    type: "fan",
    parameters: {
      blade_diameter: fanSubAssembly?.mechanical?.bladeDiameter || 400,
      blade_count: fanSubAssembly?.mechanical?.bladeCount || 5,
      pitch_angle: fanSubAssembly?.mechanical?.pitchAngle || 30,
      hub_diameter: fanSubAssembly?.mechanical?.hubDiameter || 60,
      blade_thickness: fanSubAssembly?.mechanical?.bladeThickness || 3,
      motor_shaft_diameter: fanSubAssembly?.mechanical?.motorShaftDiameter || 8,
    },
  };
}

async function callPythonCadService(inputPath: string, outputDir: string, designId: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const pythonServiceUrl = process.env.PYTHON_CAD_URL || "http://localhost:8000";
    const apiKey = process.env.PYTHON_CAD_API_KEY || "dev_key_change_in_production";
    
    // For Phase 1, we'll simulate by calling the Python script directly
    // In production, this would be an HTTP call to the FastAPI service
    const pythonScript = join(process.cwd(), "python", "fan_generator.py");
    const outputPath = join(outputDir, "output.stl");
    
    const pythonProcess = spawn("python3", [pythonScript, inputPath, outputPath], {
      env: { ...process.env, PYTHONPATH: join(process.cwd(), "python") },
    });

    let stdout = "";
    let stderr = "";

    pythonProcess.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    pythonProcess.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    pythonProcess.on("close", (code) => {
      if (code === 0) {
        resolve(outputPath);
      } else {
        reject(new Error(`Python CAD failed (code ${code}): ${stderr}`));
      }
    });

    pythonProcess.on("error", (err) => {
      reject(new Error(`Failed to spawn Python process: ${err.message}`));
    });

    // Timeout after 60 seconds
    setTimeout(() => {
      pythonProcess.kill();
      reject(new Error("CAD generation timeout"));
    }, 60000);
  });
}

worker.on("completed", async (job, result) => {
  const { designId } = job.data;
  await logToDesign(designId, "CAD job completed, queuing simulation", "info", "CAD");
  
  // Queue simulation job
  const { simQueue } = await import("@/lib/queue");
  await simQueue.add("run-simulation", {
    designId,
    cadResult: result,
  });
});

worker.on("failed", async (job, err) => {
  if (job) {
    const { designId } = job.data;
    await logToDesign(designId, `CAD job failed: ${err.message}`, "error", "CAD");
    
    await prisma.design.update({
      where: { id: designId },
      data: { status: "FAILED" },
    });
  }
});

worker.on("error", (err) => {
  console.error("CAD worker error:", err);
});

console.log("CAD worker started");

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("Shutting down CAD worker...");
  await worker.close();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("Shutting down CAD worker...");
  await worker.close();
  process.exit(0);
});