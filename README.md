# OpenMechanic

> **An open-source, AI-powered co-pilot for hardware engineers.**

Think of it as "GitHub + Fusion 360 + AI" for physical products. A user types a prompt like *"build me a wall fan, black, 400mm"* and our system drafts the CAD geometry, validates the physics via simulation, generates a Bill of Materials (BOM) from real supplier APIs, and prepares manufacturing files (STL/STEP).

**Crucially, we are NOT building a fully autonomous "magic box."** We are building an **Engineering Tool**. The AI generates the first 80% draft; the human engineer reviews, tweaks, and approves the final design. The human is always in the loop. Liability stays with the human.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Next.js 14 (App Router)                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │   Dashboard │  │   API Routes│  │  SSE Stream │             │
│  │  (React 18) │  │  /orchestrate│  │  /stream    │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
       ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
       │  PostgreSQL │ │    Redis    │ │  NVIDIA NIM │
       │   (Prisma)  │ │  (BullMQ)   │ │  (LLM API)  │
       └─────────────┘ └─────────────┘ └─────────────┘
              │               │               │
              ▼               ▼               ▼
       ┌─────────────────────────────────────────────┐
       │           BullMQ Workers                    │
       │  ┌──────────┐ ┌────────┐ ┌──────────────┐  │
       │  │Orchestr. │ │  CAD   │ │   SIM        │  │
       │  │ Worker   │ │ Worker │ │  (Skeleton)  │  │
       │  └──────────┘ └────────┘ └──────────────┘  │
       └─────────────────────────────────────────────┘
                              │
                              ▼
       ┌─────────────────────────────────────────────┐
       │        Python CAD Microservice              │
       │  ┌─────────────────────────────────────┐   │
       │  │ FastAPI + CadQuery (OCP)            │   │
       │  │ /generate → STL output              │   │
       │  └─────────────────────────────────────┘   │
       └─────────────────────────────────────────────┘
```

---

## 🤖 Multi-Agent Architecture

| Agent | Color | Responsibility |
|-------|-------|----------------|
| **Orchestrator** | ⚪ White | Decomposes prompt, coordinates sub-agents, synthesizes final spec |
| **Mechanical** | 🟢 Green | Geometry, structures, kinematics, materials, tolerances |
| **Electrical** | 🟠 Orange | Power systems, wiring, PCB layout, actuators, sensors |
| **Thermal** | 🩷 Pink | Heat dissipation, airflow, cooling, thermal stress |
| **Manufacturing** | 🟣 Purple | DFM analysis, toolpaths, tolerances, assembly sequence |
| **Cost** | 🟡 Amber | BOM pricing, supplier lookup, volume discounts, alternatives |

---

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose
- Node.js 20+ (for local development)
- Python 3.11+ (for CAD service)
- NVIDIA API Key (get from [NVIDIA NGC](https://ngc.nvidia.com))

### 1. Clone & Configure
```bash
git clone <repo-url>
cd openmechanic
cp .env.example .env.local
# Edit .env.local with your NVIDIA_API_KEY
```

### 2. Start Infrastructure
```bash
docker-compose up -d
# Starts: PostgreSQL (5432), Redis (6379), Python CAD (8000)
```

### 3. Install Dependencies
```bash
npm install
# Generates Prisma client automatically
```

### 4. Run Migrations
```bash
npx prisma migrate dev --name init
```

### 5. Start Development
```bash
# Terminal 1: Next.js (port 3000)
npm run dev

# Terminal 2: Orchestration Worker
npm run worker:orchestration

# Terminal 3: CAD Worker
npm run worker:cad

# Terminal 4: Simulation Worker (skeleton)
npm run worker:sim
```

### 6. Open Dashboard
Navigate to **http://localhost:3000**

---

## 📁 Project Structure

```
openmechanic/
├── app/                    # Next.js App Router
│   ├── api/
│   │   ├── orchestrate/    # POST - Start design generation
│   │   ├── stream/[jobId]/ # GET - SSE real-time logs
│   │   ├── designs/        # GET - Design history
│   │   └── agents/         # GET - Agent info
│   ├── components/         # React components
│   │   ├── Dashboard.tsx   # Main 4-panel layout
│   │   ├── PromptInput.tsx # Prompt + constraints
│   │   ├── ConstraintsPanel.tsx
│   │   ├── LiveLogTerminal.tsx # SSE terminal
│   │   ├── DesignHistory.tsx
│   │   ├── ThreeViewer.tsx # @react-three/fiber
│   │   ├── AgentStatusPanel.tsx
│   │   ├── AgentTimeline.tsx
│   │   └── ui/             # Customized shadcn/ui
│   ├── globals.css         # Cyberpunk theme
│   ├── layout.tsx          # Root layout
│   └── page.tsx            # Home page
├── workers/                # BullMQ Workers
│   ├── orchestration-worker.ts
│   ├── cad-worker.ts
│   ├── sim-worker.ts
│   └── shared/logger.ts
├── lib/                    # Core libraries
│   ├── agents/             # Multi-agent framework
│   │   ├── base-agent.ts
│   │   ├── orchestrator-agent.ts
│   │   ├── mechanical-agent.ts
│   │   ├── electrical-agent.ts
│   │   ├── thermal-agent.ts
│   │   ├── manufacturing-agent.ts
│   │   ├── cost-agent.ts
│   │   └── registry.ts
│   ├── prisma.ts           # Prisma client
│   ├── queue.ts            # BullMQ queues
│   ├── nim.ts              # NVIDIA NIM client
│   ├── types.ts            # Zod schemas & types
│   └── utils.ts            # Utilities
├── python/                 # Python CAD Microservice
│   ├── main.py             # FastAPI app
│   ├── fan_generator.py    # CadQuery fan generator
│   ├── requirements.txt
│   ├── pyproject.toml
│   └── Dockerfile
├── scripts/                # Standalone scripts
│   └── fan_generator.py
├── prisma/
│   └── schema.prisma       # Database schema
├── docker-compose.yml
├── Dockerfile
├── Dockerfile.worker
└── package.json
```

---

## 🎨 Design System

### Cyberpunk Engineering Aesthetic
- **Dark charcoal backgrounds** (`#0A0F1A`)
- **Neon cyan** (`#00B4D8`) primary accent
- **Agent-specific colors** for instant recognition
- **Glassmorphism cards** with backdrop blur
- **Animated grid background** with scanline overlay
- **Monospace terminal** with glow effects
- **Fonts**: Geist Sans, Geist Mono, Space Grotesk

### Component Philosophy
- Every shadcn/ui component customized
- Consistent glow/shadow system
- Agent color coding throughout
- Accessible, responsive, performant

---

## 🔧 Development Commands

```bash
# Database
npm run db:generate    # Generate Prisma client
npm run db:push        # Push schema changes
npm run db:migrate     # Run migrations
npm run db:studio      # Open Prisma Studio

# Workers
npm run worker:orchestration  # Multi-agent orchestration
npm run worker:cad            # CAD generation
npm run worker:sim            # Simulation (skeleton)

# Python CAD Service (standalone)
cd python && python fan_generator.py input.json output.stl

# Testing
npm run lint           # ESLint
npm run build          # Production build
```

---

## 📡 API Reference

### POST `/api/orchestrate`
Start a new design generation job.

**Request:**
```json
{
  "prompt": "Build me a wall fan, black, 400mm diameter, 5 blades",
  "constraints": {
    "maxHeight": 500,
    "maxWeight": 2000,
    "maxBudget": 150,
    "environment": "indoor",
    "powerSource": "mains"
  }
}
```

**Response:**
```json
{
  "jobId": "job_abc123",
  "status": "queued",
  "spec": { ... }
}
```

### GET `/api/stream/[jobId]`
Server-Sent Events stream for real-time logs.

**Events:**
- `connected` - Connection established
- `log` - General log message
- `agent_start` - Agent began processing
- `agent_complete` - Agent finished
- `agent_error` - Agent failed
- `job_update` - Progress update
- `complete` - All done
- `error` - Fatal error

### GET `/api/designs`
Fetch design history with pagination.

**Query params:** `page`, `limit`, `status`

---

## 🐳 Docker Services

| Service | Port | Description |
|---------|------|-------------|
| postgres | 5432 | PostgreSQL 16 |
| redis | 6379 | Redis 7 |
| python-cad | 8000 | FastAPI + CadQuery |
| nextjs | 3000 | Next.js App |
| worker | - | BullMQ Workers |

---

## 🔮 Roadmap

### Phase 1: Orchestrator Foundation ✅
- [x] Next.js 14 + Prisma + BullMQ + NVIDIA NIM
- [x] Multi-agent framework (6 agents)
- [x] Cyberpunk dashboard with SSE
- [x] Python CadQuery microservice
- [x] Docker Compose orchestration

### Phase 2: CAD & Simulation
- [ ] Full CadQuery integration (fan_generator.py → STL)
- [ ] Genesis/Isaac Sim physics validation
- [ ] STL/STEP export pipeline
- [ ] 3D viewer with loaded models

### Phase 3: BOM & Manufacturing
- [ ] Supplier API integration (DigiKey, Mouser, LCSC)
- [ ] Automated BOM generation
- [ ] Cost optimization engine
- [ ] Manufacturing file prep (G-code, pick-and-place)

### Phase 4: Collaboration & Evolution
- [ ] Design versioning & branching
- [ ] Team workspaces & reviews
- [ ] Evolutionary design optimization
- [ ] Plugin system for custom agents

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests & linting
5. Submit a PR

---

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

---

## 🙏 Acknowledgments

- **NVIDIA** for NIM API access
- **CadQuery/OCP** for open-source CAD kernel
- **BullMQ** for robust job queues
- **shadcn/ui** for beautiful components
- **React Three Fiber** for 3D web graphics
- **All open-source contributors** making this possible

---

**Built with ❤️ for hardware engineers everywhere.**

*OpenMechanic — Where AI meets Engineering.*