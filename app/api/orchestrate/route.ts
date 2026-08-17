import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { orchestrationQueue } from "@/lib/queue";
import { OrchestrateRequestSchema, OrchestrateResponseSchema } from "@/lib/types";
import { ConstraintsSchema } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate request
    const validation = OrchestrateRequestSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { prompt, constraints } = validation.data;
    
    // Validate constraints
    const constraintsValidation = ConstraintsSchema.safeParse(constraints || {});
    const validatedConstraints = constraintsValidation.success 
      ? constraintsValidation.data 
      : {};

    // Create design record
    const design = await prisma.design.create({
      data: {
        prompt,
        constraints: validatedConstraints,
        status: "QUEUED",
      },
    });

    // Add orchestration job to queue
    const job = await orchestrationQueue.add("orchestrate", {
      designId: design.id,
      prompt,
      constraints: validatedConstraints,
    });

    // Update design with job ID
    await prisma.design.update({
      where: { id: design.id },
      data: { 
        status: "PARSING",
      },
    });

    // Return response
    const response = OrchestrateResponseSchema.parse({
      jobId: job.id,
      status: "queued",
      spec: undefined,
    });

    return NextResponse.json(response, { status: 202 });
  } catch (error) {
    console.error("Orchestrate error:", error);
    return NextResponse.json(
      { error: "Failed to orchestrate design", message: (error as Error).message },
      { status: 500 }
    );
  }
}