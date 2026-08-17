import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const status = searchParams.get("status");
    
    const skip = (page - 1) * limit;
    
    const where = status ? { status } : {};
    
    const [designs, total] = await Promise.all([
      prisma.design.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          jobs: {
            select: { type: true, status: true },
          },
          agentRuns: {
            select: { agentType: true, status: true, confidence: true },
          },
        },
      }),
      prisma.design.count({ where }),
    ]);

    const formatted = designs.map(d => ({
      id: d.id,
      prompt: d.prompt,
      status: d.status,
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
      spec: d.spec,
      jobs: d.jobs,
      agentRuns: d.agentRuns,
    }));

    return NextResponse.json({
      designs: formatted,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Designs fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch designs", message: (error as Error).message },
      { status: 500 }
    );
  }
}