---
title: "OpenMechanic - Phase 1: The Orchestrator Foundation with Multi-Agent Architecture"
summary: "Complete migration to Next.js 14 App Router with Prisma/PostgreSQL, BullMQ/Redis, NVIDIA NIM integration, multi-agent orchestration (Mechanical, Electrical, Thermal, Manufacturing agents), cyberpunk engineering dashboard with 3D viewer, and Python CadQuery microservice - all containerized via Docker Compose using open-source tools."
status: "draft"
chatId: "141"
createdAt: "2026-08-16T18:57:54.361Z"
updatedAt: "2026-08-16T19:45:57.652Z"
---

## Overview

Build the foundational "Orchestrator" layer for OpenMechanic - an AI-powered co-pilot for hardware engineers. This phase establishes the complete infrastructure **plus a multi-agent architecture** where specialized sub-agents (Mechanical, Electrical, Thermal, Manufacturing, Cost) collaborate to parse prompts, generate specs, validate designs, and produce manufacturing-ready outputs. All built with open-source tools: Next.js 14, Prisma, BullMQ, CadQuery, FastAPI, and NVIDIA NIM.

---

## UI/UX Design

### Design Language: "Tony Stark's Holographic Workshop"
- **Color Palette**: Dark charcoal backgrounds (`#0A0F1A`), neon cyan (`#00FFFF`) and electric blue (`#00B4D8`) accents, subtle amber (`#FFB700`) for warnings, agent-specific colors (Mechanical: `#00FF88`, Electrical: `#FF6B00`, Thermal: `#FF006E`, Manufacturing: `#8B5CF6`)
- **Typography**: Geist Sans for UI, Geist Mono for terminal/logs, Space Grotesk for display headings
- **Effects**: Subtle glow on interactive elements, glassmorphism cards (`backdrop-blur-md`), animated grid background, scanline overlay, agent avatar animations
- **Layout**: Four-panel dashboard (left: agent status + history, center: prompt + 3D viewer, right: constraints + live log terminal, bottom: agent collaboration timeline)

### User Flows

1. **Landing → Generate**: User enters prompt + constraints → clicks "Generate Design" → POST `/api/orchestrate` → **Orchestrator Agent** spawns sub-agents → each agent streams thoughts/logs → real-time collaboration visible in terminal → final unified spec produced
2. **Agent Visibility**: Each agent has a status card showing current task, confidence, and reasoning
3. **History Navigation**: Sidebar shows recent designs with agent contributions
4. **3D Viewer**: Placeholder renders wireframe → later loads generated STL via `@react-three/fiber`

### Component Architecture

```
app/
├── page.tsx                          # Main dashboard (server component)
├── layout.tsx                        # Root layout with providers
├── globals.css                       # Cyberpunk theme + agent colors
├── api/
│   ├── orchestrate/route.ts          # POST - multi-agent orchestration
│   ├── stream/[jobId]/route.ts       # GET - SSE real-time agent logs
│   ├── designs/route.ts              # GET - fetch design history
│   └── agents/route.ts               # GET - agent capabilities/status
├── components/
│   ├── Dashboard.tsx                 # Main layout orchestration
│   ├── PromptInput.tsx               # Large textarea + generate button
│   ├── ConstraintsPanel.tsx          # Expandable sliders (height, weight, budget)
│   ├── LiveLogTerminal.tsx           # SSE consumer, monospace, agent-colored logs
│   ├── DesignHistory.tsx             # Sidebar grid with status badges
│   ├── ThreeViewer.tsx               # @react-three/fiber canvas
│   ├── AgentStatusPanel.tsx          # Left panel: agent avatars, status, reasoning
│   ├── AgentTimeline.tsx             # Bottom: collaboration sequence visualization
│   └── ui/                           # Customized shadcn components
```

---

## Multi-Agent Architecture (NEW)

### Agent Roles & Responsibilities

| Agent | Color | Responsibility | Tools |
|-------|-------|----------------|-------|
| **Orchestrator** | `#FFFFFF` | Decomposes prompt, coordinates sub-agents, synthesizes final spec | NIM LLM, prompt templates |
| **Mechanical** | `#00FF88` | Geometry, structures, kinematics, materials, tolerances | CadQuery, FEA validation |
| **Electrical** | `#FF6B00` | Power systems, wiring, PCB layout, actuators, sensors | KiCad API, SPICE simulation |
| **Thermal** | `#FF006E` | Heat dissipation, airflow, cooling, thermal stress | CFD (Genesis/Isaac Sim) |
| **Manufacturing** | `#8B5CF6` | DFM analysis, toolpaths, tolerances, assembly sequence | CAM, STL/STEP validation |
| **Cost** | `#FFB700` | BOM pricing, supplier lookup, volume discounts, alternatives | Supplier APIs (DigiKey, Mouser, LCSC) |

### Agent Communication Protocol

```typescript
// Each agent receives a structured context and returns a structured response
interface AgentContext {
  prompt: string;
  constraints: Constraints;
  previousOutputs: Record<string, AgentOutput>;  // Other agents' outputs
  designId: string;
}

interface AgentOutput {
  agent: AgentType;
  status: 'thinking' | 'complete' | 'error' | 'needs_review';
  spec: Partial<ProjectSpec>;      // Their contribution to the spec
  reasoning: string;               // Human-readable explanation
  confidence: number;              // 0-1
  warnings: string[];
  questionsForHuman?: string[];    // Clarifications needed
  nextAgentHints?: string[];       // Suggestions for downstream agents
}
```

### Orchestration Flow

```
User Prompt + Constraints
         │
         ▼
┌─────────────────────────────────────┐
│         ORCHESTRATOR AGENT          │
│  - Parses prompt to high-level spec │
│  - Determines required sub-agents   │
│  - Creates execution plan           │
└─────────────────────────────────────┘
         │
    ┌────┴────┬─────────┬──────────┐
    ▼         ▼         ▼          ▼
Mechanical Electrical Thermal  Manufacturing (parallel)
    │         │         │          │
    └────┬────┴────┬────┴──────────┘
         ▼         ▼
      Cost Agent (sequential, needs BOM)
         │
         ▼
┌─────────────────────────────────────┐
│         ORCHESTRATOR AGENT          │
│  - Merges all agent outputs         │
│  - Resolves conflicts               │
│  - Produces unified ProjectSpec     │
│  - Flags items for human review     │
└─────────────────────────────────────┘
         │
         ▼
    Queue CAD Job (BullMQ)
```

---

## Considerations

### Technical Challenges

| Challenge | Mitigation |
|-----------|------------|
| **Next.js + BullMQ Workers** | Workers run as separate Node processes (`npm run worker`), not in Next.js server |
| **SSE in App Router** | Use `ReadableStream` with proper headers; handle connection lifecycle |
| **Prisma Client in Workers** | Generate Prisma client in `postinstall`; workers import from `@prisma/client` |
| **Python/Node.js Bridge** | `child_process.spawn` with JSON stdin/stdout; Docker networking for microservice |
| **Multi-Agent Coordination** | Redis pub/sub for agent-to-agent messaging; shared context in DB |
| **TypeScript Strictness** | Enable `strict: true`; define all API contracts with Zod schemas |
| **Port Conflicts** | Next.js 3000, Postgres 5432, Redis 6379, Python 8000 |

### Trade-offs

- **Phase 1 Agents**: Mechanical + Electrical + Orchestrator implemented; Thermal, Manufacturing, Cost as skeletons
- **Agent LLM Calls**: Each agent makes 1-2 NIM calls; optimize with prompt caching
- **Simulation Worker**: Skeleton only - full physics integration in Phase 2
- **Auth**: Deferred to Phase 2 (single-user assumption for now)
- **File Storage**: Local filesystem for STL outputs; S3-compatible in Phase 2

### Edge Cases

- Agent disagreement → Orchestrator flags for human review with reasoning
- Agent timeout → Mark partial output, continue with others, flag incomplete
- Prompt parsing fails → Return structured error, mark design FAILED
- Worker crashes → BullMQ retry (max 3 attempts) with exponential backoff
- SSE disconnect → Client auto-reconnects with last event ID
- Database migration → `prisma migrate deploy` in Docker entrypoint

---

## Technical Approach

### Architecture Decisions

1. **Next.js 14 App Router** - Server Components by default, Client Components for interactivity
2. **Prisma ORM** - Type-safe database access, migrations in Docker
3. **BullMQ + Redis** - Reliable job queue with priority, delayed jobs, metrics
4. **NVIDIA NIM** - `@ai-sdk/openai-compatible` client, structured JSON output via Zod
5. **Docker Compose** - 5 services: `postgres`, `redis`, `nextjs`, `python-cad`, `worker`
6. **Python Microservice** - FastAPI on port 8000, receives JSON, returns STL path
6. **Multi-Agent System** - Each agent = separate prompt template + structured output schema

### Key Libraries

| Purpose | Library |
|---------|---------|
| AI SDK | `@ai-sdk/openai-compatible`, `zod` |
| Queue | `bullmq`, `ioredis` |
| Database | `@prisma/client`, `prisma` |
| 3D | `@react-three/fiber`, `@react-three/drei`, `three` |
| Validation | `zod` |
| Styling | `tailwindcss`, `tailwindcss-animate`, `clsx`, `tailwind-merge` |
| Python | `fastapi`, `uvicorn`, `cadquery`, `python-dotenv` |
| Agent Comms | `ioredis` pub/sub, custom event bus |

### Data Models (Prisma Schema) - Extended for Agents

```prisma
enum DesignStatus {
  QUEUED
  PARSING
  AGENTS_RUNNING
  CAD_GENERATING
  SIMULATING
  APPROVAL_NEEDED
  COMPLETE
  FAILED
}

enum JobType {
  CAD
  SIM
  EVOLVE
  AGENT_ORCHESTRATION
}

enum JobStatus {
  PENDING
  PROCESSING
  COMPLETED
  FAILED
}

enum AgentType {
  ORCHESTRATOR
  MECHANICAL
  ELECTRICAL
  THERMAL
  MANUFACTURING
  COST
}

model Design {
  id            String      @id @default(cuid())
  prompt        String
  constraints   Json
  status        DesignStatus @default(QUEUED)
  spec          Json?       // Final unified ProjectSpec
  agentOutputs  Json?       // All agent outputs for traceability
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt
  jobs          Job[]
}

model Job {
  id        String   @id @default(cuid())
  designId  String
  design    Design   @relation(fields: [designId], references: [id], onDelete: Cascade)
  type      JobType
  status    JobStatus @default(PENDING)
  result    Json?
  error     Json?
  attempts  Int      @default(0)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([designId])
  @@index([status])
}

model AgentRun {
  id          String    @id @default(cuid())
  designId    String
  agentType   AgentType
  status      JobStatus @default(PENDING)
  input       Json
  output      Json?
  reasoning   String?
  confidence  Float?
  warnings    String[]
  startedAt   DateTime?
  completedAt DateTime?
  createdAt   DateTime  @default(now())

  @@index([designId])
}
```

### ProjectSpec JSON Schema (Zod) - Extended

```typescript
const ProjectSpecSchema = z.object({
  type: z.string(),                    // "wall_fan", "drone", "robotic_arm"
  height: z.number(),                  // mm
  weight: z.number(),                  // grams
  payload: z.number(),                 // grams
  budget: z.number(),                  // USD
  environment: z.enum(["indoor", "outdoor", "industrial", "space"]),
  powerSource: z.enum(["battery", "mains", "solar", "pneumatic"]),
  successMetrics: z.array(z.string()), // ["airflow", "quiet", "efficiency"]
  subAssemblies: z.array(z.object({
    name: z.string(),
    function: z.string(),
    constraints: z.record(z.unknown()),
    // Agent-specific fields:
    mechanical: z.object({ material: z.string(), process: z.string() }).optional(),
    electrical: z.object({ voltage: z.number(), power: z.number() }).optional(),
    thermal: z.object({ maxTemp: z.number(), cooling: z.string() }).optional(),
  })),
  // Agent contributions (for traceability)
  agentContributions: z.record(z.object({
    agent: z.string(),
    spec: z.unknown(),
    reasoning: z.string(),
    confidence: z.number(),
  })),
});
```

---

## Implementation Steps

### Phase 0: Project Migration & Setup

1. **Delete Vite config**, create `next.config.ts` with port 3000, turbopack
2. **Create `package.json`** with Next.js 14, all dependencies
3. **Set up TypeScript config** for Next.js (strict mode)
4. **Configure Tailwind** with cyberpunk theme + agent colors
5. **Create directory structure**: `app/`, `lib/`, `workers/`, `prisma/`, `scripts/`, `python/`, `agents/`

### Phase 1: Database & Infrastructure

6. **Prisma Schema** (`prisma/schema.prisma`) with Design/Job/AgentRun models
7. **Docker Compose** (`docker-compose.yml`): postgres, redis, nextjs, python-cad, worker
8. **Environment files**: `.env.example`, `.env.local` (gitignored)
9. **Prisma Client generation** in `postinstall` script

### Phase 2: Core Library Code

10. **NVIDIA NIM Client** (`lib/nim.ts`): configured client + `parsePromptWithNIM()`
11. **Queue Setup** (`lib/queue.ts`): BullMQ connection, queue definitions, job types
12. **Database Client** (`lib/prisma.ts`): singleton Prisma client
13. **Types** (`lib/types.ts`): Zod schemas, TypeScript interfaces
14. **Agent Framework** (`lib/agents/`):
    - `base-agent.ts`: Abstract base class with NIM calling, logging, context passing
    - `orchestrator-agent.ts`: Decomposes prompt, coordinates, synthesizes
    - `mechanical-agent.ts`: Geometry, materials, structures
    - `electrical-agent.ts`: Power, wiring, actuators
    - `thermal-agent.ts`: (Skeleton) Heat, airflow
    - `manufacturing-agent.ts`: (Skeleton) DFM, toolpaths
    - `cost-agent.ts`: (Skeleton) BOM, supplier pricing
    - `registry.ts`: Agent registry, execution order, dependency graph

### Phase 3: API Routes

15. **POST `/api/orchestrate`**: Validate input → create Design → spawn Orchestrator Agent job → return jobId
16. **GET `/api/stream/[jobId]`**: SSE endpoint streaming agent logs from Redis pub/sub
17. **GET `/api/designs`**: Paginated design history with status
18. **GET `/api/agents`**: Agent capabilities, status, health

### Phase 4: BullMQ Workers

19. **Orchestration Worker** (`workers/orchestration-worker.ts`): Runs multi-agent pipeline, updates AgentRun records, emits logs to Redis
20. **CAD Worker** (`workers/cad-worker.ts`): Process queue, simulate work, call Python service, update job/design status
21. **SIM Worker** (`workers/sim-worker.ts`): Skeleton with proper structure
22. **Worker Entry Points**: `package.json` scripts for `worker:orchestration`, `worker:cad`, `worker:sim`

### Phase 5: Python CadQuery Microservice

23. **Python Project** (`python/`): `pyproject.toml`, `requirements.txt`, `Dockerfile`
24. **FastAPI App** (`python/main.py`): `/generate` endpoint, JSON input → STL output
25. **Fan Generator** (`python/fan_generator.py`): CadQuery script reading `input.json`, writing `output.stl`
26. **Docker Integration**: Service in compose, health checks, volume for STL output

### Phase 6: Frontend Dashboard

27. **Root Layout** (`app/layout.tsx`): Providers, global styles, font loading
28. **Main Page** (`app/page.tsx`): Server component fetching initial designs
29. **Dashboard Client** (`components/Dashboard.tsx`): Four-panel layout
30. **Prompt Input** (`components/PromptInput.tsx`): Textarea + generate button
31. **Constraints Panel** (`components/ConstraintsPanel.tsx`): Accordion with sliders
32. **Live Log Terminal** (`components/LiveLogTerminal.tsx`): SSE hook, monospace, agent-colored logs
33. **Design History** (`components/DesignHistory.tsx`): Grid with status badges
34. **Three Viewer** (`components/ThreeViewer.tsx`): React Three Fiber canvas
35. **Agent Status Panel** (`components/AgentStatusPanel.tsx`): Left panel with agent avatars, real-time status, reasoning
36. **Agent Timeline** (`components/AgentTimeline.tsx`): Bottom visualization of agent collaboration sequence

### Phase 7: Polish & Integration

37. **Cyberpunk Theme** (`app/globals.css`): CSS variables, animations, grid background, agent colors
38. **Custom shadcn Components**: Button, Card, Input, Slider, Badge, ScrollArea, Avatar
39. **Error Boundaries & Toasts**: Sonner for notifications
40. **README.md**: Setup instructions, commands, architecture diagram, agent guide

---

## Code Changes

### New Files to Create

```
├── next.config.ts
├── package.json                    # Complete rewrite with agent deps
├── tsconfig.json                   # Next.js config
├── tailwind.config.ts              # Cyberpunk theme + agent colors
├── postcss.config.js
├── .env.example
├── .gitignore                      # Updated for Next.js
├── docker-compose.yml              # 5 services
├── prisma/
│   └── schema.prisma               # Extended with AgentRun
├── lib/
│   ├── prisma.ts
│   ├── queue.ts
│   ├── nim.ts
│   ├── types.ts
│   ├── utils.ts
│   └── agents/
│       ├── base-agent.ts
│       ├── orchestrator-agent.ts
│       ├── mechanical-agent.ts
│       ├── electrical-agent.ts
│       ├── thermal-agent.ts
│       ├── manufacturing-agent.ts
│       ├── cost-agent.ts
│       └── registry.ts
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   ├── globals.css
│   ├── api/
│   │   ├── orchestrate/route.ts
│   │   ├── stream/[jobId]/route.ts
│   │   ├── designs/route.ts
│   │   └── agents/route.ts
│   └── components/
│       ├── Dashboard.tsx
│       ├── PromptInput.tsx
│       ├── ConstraintsPanel.tsx
│       ├── LiveLogTerminal.tsx
│       ├── DesignHistory.tsx
│       ├── ThreeViewer.tsx
│       ├── AgentStatusPanel.tsx
│       ├── AgentTimeline.tsx
│       └── ui/                     # Customized shadcn components
├── workers/
│   ├── orchestration-worker.ts
│   ├── cad-worker.ts
│   ├── sim-worker.ts
│   └── shared/
│       └── logger.ts               # Structured logging to Redis pub/sub
├── python/
│   ├── Dockerfile
│   ├── pyproject.toml
│   ├── requirements.txt
│   ├── main.py
│   └── fan_generator.py
├── scripts/
│   └── fan_generator.py            # Copy for reference
└── README.md
```

### Files to Delete/Replace

- `vite.config.ts` → `next.config.ts`
- `src/` → `app/` (App Router structure)
- `index.html` → removed (Next.js handles)
- `package.json` → complete rewrite

---

## Testing Strategy

### Unit Tests (Vitest)

- `lib/nim.test.ts`: Mock NIM API, test prompt parsing
- `lib/queue.test.ts`: Test job creation, status updates
- `lib/types.test.ts`: Zod schema validation
- `lib/agents/*.test.ts`: Each agent's prompt template, output parsing
- `workers/orchestration-worker.test.ts`: Mock BullMQ, test multi-agent flow

### Integration Tests

- **API Routes**: Test `/api/orchestrate` creates Design + AgentRuns, queues orchestration
- **SSE Stream**: Test connection, agent event emission, reconnection
- **Database**: Prisma operations with testcontainers (PostgreSQL)
- **Agent Communication**: Redis pub/sub message passing

### E2E Tests (Playwright)

1. **Happy Path**: Enter prompt → click generate → see agent logs → design appears in history
2. **Agent Visibility**: Verify each agent shows status, reasoning, confidence
3. **Constraints**: Adjust sliders → verify values sent to all agents
4. **Error Handling**: Invalid prompt → toast error, design status FAILED
5. **SSE Reconnection**: Simulate network disruption → verify auto-reconnect
6. **Agent Disagreement**: Mock conflicting outputs → verify human review flag

### Manual Verification Checklist

- [ ] `docker-compose up -d` starts all 5 services healthy
- [ ] `npm run dev` serves Next.js on localhost:3000
- [ ] `npm run worker:orchestration` starts orchestration worker
- [ ] `npm run worker:cad` starts CAD worker
- [ ] Dashboard loads with cyberpunk theme + agent panel
- [ ] Prompt submission creates design, runs agents, streams logs
- [ ] Agent status panel shows each agent's reasoning in real-time
- [ ] Agent timeline visualizes collaboration sequence
- [ ] Design history displays with correct status badges
- [ ] 3D viewer renders placeholder geometry
- [ ] Python service responds to `/generate` with STL file
- [ ] Prisma Studio accessible (`npx prisma studio`)

---

## Commands Summary

```bash
# Initial setup
docker-compose up -d                          # Start Postgres, Redis, Python
npm install                                   # Install deps + generate Prisma client
npx prisma migrate dev --name init            # Run migrations

# Development
npm run dev                                   # Next.js on :3000
npm run worker:orchestration                  # Multi-agent orchestration worker
npm run worker:cad                            # CAD worker process
npm run worker:sim                            # SIM worker (skeleton)

# Database
npx prisma studio                             # Visual DB browser
npx prisma migrate reset                      # Reset DB

# Python
cd python && python fan_generator.py          # Test CadQuery script directly
```

---

## Open Source Stack Summary

| Layer | Technology | License |
|-------|------------|---------|
| Frontend | Next.js 14, React 19, Tailwind CSS | MIT |
| UI Components | Radix UI, shadcn/ui | MIT |
| 3D | Three.js, React Three Fiber, Drei | MIT |
| Database | PostgreSQL, Prisma ORM | PostgreSQL/Apache-2.0 |
| Queue | Redis, BullMQ | MIT/BSD-3 |
| AI | NVIDIA NIM (OpenAI-compatible API) | NVIDIA |
| CAD | CadQuery, OCP (OpenCASCADE) | LGPL/BSD |
| Physics | Genesis (NVIDIA), Isaac Sim | Custom/Proprietary* |
| Python Web | FastAPI, Uvicorn | MIT |
| Containerization | Docker, Docker Compose | Apache-2.0 |

*Physics engine integration planned for Phase 2; Genesis is open-source (Apache-2.0)