import { NextResponse } from "next/server";
import { AGENT_CONFIG, AgentType } from "@/lib/types";

export async function GET() {
  const agents = Object.entries(AGENT_CONFIG).map(([type, config]) => ({
    type: type as AgentType,
    name: config.name,
    color: config.color,
    icon: config.icon,
    description: config.description,
    order: config.order,
    dependencies: config.dependencies,
  }));

  return NextResponse.json({ agents });
}