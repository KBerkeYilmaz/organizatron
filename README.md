# Organizatron

AI-powered task organizer and time tracker with intelligent scheduling.

## Overview

Organizatron is a full-stack productivity application that combines time tracking with AI-powered task management. It features intelligent task estimation, automated project planning, and agentic AI capabilities that can autonomously create subtasks and schedule work.

## Features

### Core Functionality

- **Dashboard** - Today's tasks, time summary, recent activity, and project insights
- **Task Management** - CRUD operations, table view with filtering, bulk operations, and billable task support
- **Projects (Kanban)** - Drag-and-drop Kanban board with project status tracking
- **Time Tracking** - Active timer with media player controls, time entries with period filtering
- **Offline Support** - Queue actions while offline, sync with retry when back online

### AI Features

Powered by multiple AI providers (Groq/Llama, Google Gemini, Claude) with intelligent fallbacks:

- **Task Assist** - Combined time estimation and tag suggestions based on similar completed tasks
- **Goal Breakdown** - Break high-level goals into actionable tasks with time estimates
- **Task Guidance** - Step-by-step instructions, learning resources, and AI assistant prompts
- **Project Analysis** - Analyze all tasks, suggest execution order, identify dependencies

### Agentic AI

Beyond suggestions, the AI can take autonomous actions:

- **Agentic Task Guidance** - Create subtasks, update estimates, add tags and priorities
- **Agentic Project Planner** - Reorder tasks, schedule across time, update priorities, create subtasks

## Tech Stack

| Category | Technology |
|----------|------------|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| UI Components | shadcn/ui + Radix primitives |
| Database | PostgreSQL via Prisma 7 |
| API Layer | tRPC v11 with React Query v5 |
| State Management | Jotai (timer state) |
| Drag & Drop | dnd-kit |
| Auth | Better Auth |
| AI | Vercel AI SDK (Groq, Gemini, Claude) |

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 9+
- PostgreSQL database

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/organizatron.git
cd organizatron

# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Push database schema
pnpm db:push

# Start development server
pnpm dev
```

### Environment Variables

**Required:**
```env
DATABASE_URL="postgresql://..."
BETTER_AUTH_SECRET="your-secret-min-32-chars"
```

**Optional (for AI features):**
```env
GROQ_API_KEY="..."           # Primary AI provider (Llama 3.3 70B)
GOOGLE_GENERATIVE_AI_API_KEY="..."  # Fallback AI (Gemini 2.5 Flash)
ANTHROPIC_API_KEY="..."      # Alternative AI (Claude)
TAVILY_API_KEY="..."         # Web search for AI context
```

**Optional (for Google Calendar):**
```env
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."
```

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── api/               # API routes (tRPC, AI, auth)
│   ├── (auth)/            # Login/signup pages
│   └── (dashboard)/       # Main app pages
├── components/            # React components
│   ├── ui/               # shadcn/ui primitives
│   ├── ai-*.tsx          # AI feature components
│   └── *-modal.tsx       # Modal dialogs
├── hooks/                 # Custom React hooks
├── lib/                   # Utilities and configurations
├── server/
│   ├── api/routers/      # tRPC routers
│   └── services/         # AI service, rate limiter
├── store/                # Jotai atoms
└── trpc/                 # tRPC client setup

prisma/
└── schema.prisma         # Database schema

e2e/                      # Playwright E2E tests
```

## Available Scripts

```bash
pnpm dev              # Start dev server
pnpm build            # Production build
pnpm start            # Start production server
pnpm db:push          # Push schema to database
pnpm db:studio        # Open Prisma Studio
pnpm typecheck        # Run TypeScript checks
pnpm test             # Run unit tests (watch mode)
pnpm test:ui          # Run tests with Vitest UI
pnpm test:coverage    # Run tests with coverage
pnpm test:e2e         # Run Playwright E2E tests
pnpm test:e2e:ui      # Run E2E tests with UI
```

## Database Schema

```
Client → Project → Task → TimeEntry
                      ↓
                 ActiveTimer
```

- **Client** - Company/client entity with color coding
- **Project** - Belongs to client, has status (planning, active, on_hold, completed, archived)
- **Task** - Core entity with status, priority, billing info, time estimates, tags
- **TimeEntry** - Time records with start/end times, duration, notes
- **ActiveTimer** - Persistent timer state with pause/resume support

## API Routes

### tRPC Routers

| Router | Purpose |
|--------|---------|
| `clients` | Client CRUD operations |
| `project` | Project management |
| `task` | Task CRUD and filtering |
| `timeEntry` | Time entry management |
| `activeTimer` | Timer control |
| `stats` | Analytics and insights |
| `ai` | All AI features |
| `googleCalendar` | Calendar integration |

### AI Endpoints

All AI endpoints are rate-limited and require authentication:

| Endpoint | Rate Limit | Description |
|----------|------------|-------------|
| `taskAssist` | 10/min | Combined time + tag suggestions |
| `breakdown` | 2/min | Goal → task breakdown |
| `guidance` | 2/min | Task guidance and resources |
| `agentic` | 1/min | Autonomous AI actions |
| `chat` | 5/min | Streaming AI assistant |

## Testing

This project follows TDD practices with colocated tests:

```
src/lib/utils.ts        # Implementation
src/lib/utils.test.ts   # Unit tests
```

**Testing Stack:**
- **Vitest** - Unit and integration tests
- **React Testing Library** - Component testing
- **Playwright** - E2E tests

## Roadmap

- [ ] Team/multi-user support
- [ ] Detailed reports with export
- [ ] Advanced scheduling algorithms

## License

MIT

## Acknowledgments

Built with the [T3 Stack](https://create.t3.gg/) and enhanced with AI capabilities using the Vercel AI SDK.
