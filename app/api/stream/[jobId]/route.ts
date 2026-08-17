import { NextRequest, NextResponse } from "next/server";
import { redisSubscriber } from "@/lib/queue";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  
  // Get design ID from job
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    select: { designId: true },
  });

  if (!job) {
    return new NextResponse("Job not found", { status: 404 });
  }

  const designId = job.designId;
  const channel = `design:${designId}:events`;

  // Create SSE stream
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      
      // Send initial connection event
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({
        type: "connected",
        timestamp: new Date().toISOString(),
        message: `Connected to design ${designId}`,
        level: "info",
      })}\n\n`));

      // Subscribe to Redis channel
      await redisSubscriber.subscribe(channel);
      
      const handler = (channel: string, message: string) => {
        try {
          controller.enqueue(encoder.encode(`data: ${message}\n\n`));
        } catch {
          // Controller closed, ignore
        }
      };

      redisSubscriber.on("message", handler);

      // Handle client disconnect
      request.signal.addEventListener("abort", () => {
        redisSubscriber.off("message", handler);
        redisSubscriber.unsubscribe(channel);
        controller.close();
      });

      // Send periodic heartbeat
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: heartbeat\n\n`));
        } catch {
          clearInterval(heartbeat);
        }
      }, 30000);

      request.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
      });
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}