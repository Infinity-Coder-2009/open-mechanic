import { Worker } from "bullmq";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/queue";
import { runOrchestration } from "@/lib/agents/registry";
import { OrchestrationJobData } from "@/lib/types";
import { logToDesign, emitJobUpdate } from "./shared/logger";

console.log("Starting Orchestration Worker...");

const worker = new Worker<OrchestrationJobData>(
  "orchestration",
  async (job) => {
    const { designId, prompt, constraints } = job.data;
    
    await logToDesign(designId, "Orchestration worker started", "info", "ORCHESTRATOR");
    
    // Update design status
    await prisma.design.update({
      where: { id: designId },
      data: { status: "AGENTS_RUNNING" },
    });

    await emitJobUpdate(designId, 0, "Starting multi-agent orchestration...", "ORCHESTRATOR");

    try {
      // Run the full orchestration pipeline
      const result = await runOrchestration(designId, prompt, constraints);
      
      await emitJobUpdate(designId, 100, "Orchestration complete. Queuing CAD generation...", "ORCHESTRATOR");
      await logToDesign(designId, "Orchestration complete, queuing CAD job", "info", "ORCHESTRATOR");
      
      // Update job result
      return { 
        success: true, 
        spec: result.spec,
        agentOutputs: result.agentOutputs,
      };
    } catch (error) {
      const err = error as Error;
      await logToDesign(designId, `Orchestration failed: ${err.message}`, "error", "ORCHESTRATOR");
      
      await prisma.design.update({
        where: { id: designId },
        data: { 
          status: "FAILED",
        },
      });
      
      throw error;
    }
  },
  {
    connection: redis,
    concurrency: parseInt(process.env.WORKER_CONCURRENCY || "2"),
  }
);

worker.on("completed", async (job) => {
  const { designId } = job.data;
  await logToDesign(designId, "Orchestration job completed", "info", "ORCHESTRATOR");
  
  // Queue CAD job if orchestration succeeded
  const design = await prisma.design.findUnique({ where: { id: designId } });
  if (design && design.spec) {
    const { cadQueue } = await import("@/lib/queue");
    await cadQueue.add("generate-cad", {
      designId,
      spec: design.spec,
    });
    await logToDesign(designId, "CAD job queued", "info", "ORCHESTRATOR");
  }
});

worker.on("failed", async (job, err) => {
  if (job) {
    const { designId } = job.data;
    await logToDesign(designId, `Orchestration job failed: ${err.message}`, "error", "ORCHESTRATOR");
    
    await prisma.design.update({
      where: { id: designId },
      data: { status: "FAILED" },
    });
  }
});

worker.on("error", (err) => {
  console.error("Orchestration worker error:", err);
});

console.log("Orchestration worker started");

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("Shutting down orchestration worker...");
  await worker.close();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("Shutting down orchestration worker...");
  await worker.close();
  process.exit(0);
});