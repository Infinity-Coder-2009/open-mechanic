import { Queue, QueueEvents, Worker, Job } from "bullmq";
import { Redis } from "ioredis";
import { prisma } from "./prisma";

// Redis connection
const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

export const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
  retryStrategy: (times) => {
    if (times > 3) return null;
    return Math.min(times * 200, 2000);
  },
});

export const redisSubscriber = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
});

// Queue names
export const QUEUE_NAMES = {
  ORCHESTRATION: "orchestration",
  CAD: "cad",
  SIM: "sim",
} as const;

// Create queues
export const orchestrationQueue = new Queue(QUEUE_NAMES.ORCHESTRATION, {
  connection: redis,
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 50,
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 5000,
    },
  },
});

export const cadQueue = new Queue(QUEUE_NAMES.CAD, {
  connection: redis,
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 50,
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 10000,
    },
  },
});

export const simQueue = new Queue(QUEUE_NAMES.SIM, {
  connection: redis,
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 50,
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 15000,
    },
  },
});

// Queue events for monitoring
export const orchestrationQueueEvents = new QueueEvents(QUEUE_NAMES.ORCHESTRATION, {
  connection: redisSubscriber,
});

export const cadQueueEvents = new QueueEvents(QUEUE_NAMES.CAD, {
  connection: redisSubscriber,
});

export const simQueueEvents = new QueueEvents(QUEUE_NAMES.SIM, {
  connection: redisSubscriber,
});

// Job data types
export interface OrchestrationJobData {
  designId: string;
  prompt: string;
  constraints: Record<string, unknown>;
}

export interface CadJobData {
  designId: string;
  spec: Record<string, unknown>;
}

export interface SimJobData {
  designId: string;
  cadResult: Record<string, unknown>;
}

// Helper functions
export async function addOrchestrationJob(data: OrchestrationJobData) {
  const job = await orchestrationQueue.add("orchestrate", data);
  return job;
}

export async function addCadJob(data: CadJobData) {
  const job = await cadQueue.add("generate-cad", data);
  return job;
}

export async function addSimJob(data: SimJobData) {
  const job = await simQueue.add("run-simulation", data);
  return job;
}

export async function getJobStatus(queueName: string, jobId: string) {
  const queue = getQueue(queueName);
  const job = await queue.getJob(jobId);
  if (!job) return null;
  const state = await job.getState();
  return { id: job.id, name: job.name, data: job.data, state, progress: job.progress };
}

function getQueue(name: string) {
  switch (name) {
    case QUEUE_NAMES.ORCHESTRATION:
      return orchestrationQueue;
    case QUEUE_NAMES.CAD:
      return cadQueue;
    case QUEUE_NAMES.SIM:
      return simQueue;
    default:
      throw new Error(`Unknown queue: ${name}`);
  }
}

// Graceful shutdown
export async function closeQueues() {
  await Promise.all([
    orchestrationQueue.close(),
    cadQueue.close(),
    simQueue.close(),
    orchestrationQueueEvents.close(),
    cadQueueEvents.close(),
    simQueueEvents.close(),
    redis.quit(),
    redisSubscriber.quit(),
  ]);
}