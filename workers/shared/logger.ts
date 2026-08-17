import { redis } from "@/lib/queue";

export async function logToDesign(
  designId: string,
  message: string,
  level: "info" | "warn" | "error" | "debug" = "info",
  agent?: string,
  data?: unknown
) {
  const event = {
    type: "log",
    timestamp: new Date().toISOString(),
    agent,
    message,
    data,
    level,
  };
  
  await redis.publish(`design:${designId}:events`, JSON.stringify(event));
  
  const prefix = agent ? `[${agent}]` : "[WORKER]";
  switch (level) {
    case "error":
      console.error(prefix, message, data);
      break;
    case "warn":
      console.warn(prefix, message, data);
      break
    case "debug":
      console.debug(prefix, message, data);
      break;
    default:
      console.log(prefix, message, data);
  }
}

export async function emitJobUpdate(designId: string, progress: number, message: string, agent?: string) {
  const event = {
    type: "job_update",
    timestamp: new Date().toISOString(),
    agent,
    message,
    data: { progress },
    level: "info",
  };
  
  await redis.publish(`design:${designId}:events`, JSON.stringify(event));
}