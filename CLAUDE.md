# Organizatron

AI-powered task organizer and time tracker with intelligent scheduling.

## Current Status

Core time tracking is implemented:

- **Dashboard**: Today's tasks, time summary, recent activity, projects overview
- **Tasks Page**: CRUD, table view, filtering, bulk operations
- **Projects Page**: Kanban board with drag-and-drop
- **Time Entries Page**: Period/entity filtering
- **Active Timer**: Media player-style controls
- **Billable Tasks**: Hourly rates, currency, billing status
- **Offline Sync**: Queue actions offline, sync with retry
- **Timer Persistence**: localStorage survival

### Database: Client → Project → Task → TimeEntry + ActiveTimer

### tRPC Routers: clients, project, task, timeEntry, activeTimer, stats

## Project Vision

A demo project for learning AI integrations, AWS services, and Supabase functions. The app acts as a smart time tracker that:

- **Intelligent Scheduling**: Assigns tasks to Google Calendar based on urgency and priorities
- **Task Grouping**: Groups related tasks and provides realistic timelines
- **AI Suggestions**: Offers documentation recommendations and workflow improvements
- **Time Tracking**: Tracks time spent on tasks with smart analytics

## Tech Stack

- **Framework**: Next.js 16 (App Router, Turbopack)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **UI Components**: shadcn/ui + Radix primitives
- **Database**: PostgreSQL via Prisma 7
- **Backend**: Supabase (planned for auth, storage, realtime)
- **API Layer**: tRPC v11 with React Query v5
- **State Management**: Jotai for timer state
- **Drag & Drop**: dnd-kit for Kanban
- **Auth**: Better Auth (planned)
- **Deployment**: AWS (target platform)
- **AI**: Claude API for intelligent features (planned)

## Package Manager

This project uses **pnpm**. Always use `pnpm` commands:

```bash
pnpm install          # Install dependencies
pnpm dev              # Start dev server
pnpm build            # Production build
pnpm db:push          # Push schema to database
pnpm db:studio        # Open Prisma Studio
pnpm typecheck        # Run TypeScript checks
pnpm test             # Run unit tests (watch mode)
pnpm test:ui          # Run tests with UI
pnpm test:coverage    # Run tests with coverage
pnpm test:e2e         # Run E2E tests
pnpm test:e2e:ui      # Run E2E tests with UI
```

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   └── (dashboard)/        # Dashboard layout group
│       ├── page.tsx        # Home/Dashboard
│       ├── tasks/          # Tasks list page
│       ├── projects/       # Projects Kanban page
│       └── time-entries/   # Time entries page
├── components/             # React components
│   ├── ui/                 # shadcn/ui components
│   ├── active-timer.tsx    # Timer component
│   ├── task-*.tsx          # Task-related components
│   ├── project-*.tsx       # Project-related components
│   └── time-*.tsx          # Time entry components
├── hooks/                  # Custom React hooks
│   ├── use-timer.ts        # Timer logic hook
│   ├── use-offline-sync.ts # Offline sync hook
│   └── use-timer-*.ts      # Timer utility hooks
├── lib/                    # Utilities and configurations
│   ├── offline-queue.ts    # Offline action queue
│   ├── timer-storage.ts    # Timer localStorage persistence
│   └── format.ts           # Formatting utilities
├── server/                 # tRPC routers and server logic
│   └── api/routers/        # Individual tRPC routers
├── store/                  # Jotai atoms
│   └── timer-atoms.ts      # Timer state atoms
├── styles/                 # Global styles
└── trpc/                   # tRPC client setup
prisma/
└── schema.prisma           # Database schema
e2e/                        # Playwright E2E tests
```

## Upcoming Features

1. **Authentication** - Better Auth integration with user sessions
2. **Google Calendar API** - Sync tasks and time blocks to calendar
3. **AI Features** - Claude-powered task suggestions and time estimates
4. **Reports** - Detailed time reports with export options
5. **Team Support** - Multi-user with roles and permissions

## Development Guidelines

- Use server components by default, client components only when needed
- Validate all inputs with Zod schemas
- Use tRPC for type-safe API calls
- Follow existing code patterns in the codebase
- Timer actions should work offline (queued and synced)

## Testing Strategy (TDD)

This project follows Test-Driven Development practices.

### The TDD Cycle

1. **Red**: Write a failing test first
2. **Green**: Write minimal code to pass the test
3. **Refactor**: Clean up while keeping tests green

### Test Structure

```
src/
├── lib/
│   ├── utils.ts          # Implementation
│   └── utils.test.ts     # Unit tests (colocated)
├── server/api/routers/
│   ├── task.ts           # Router implementation
│   └── task.test.ts      # Router tests (colocated)
e2e/
└── home.spec.ts          # E2E tests (separate folder)
```

### Testing Tools

- **Vitest**: Unit and integration tests (fast, ESM-native)
- **React Testing Library**: Component testing (behavior-focused)
- **Playwright**: E2E tests (cross-browser)

### What to Test

| Layer | What to Test | Tool |
|-------|--------------|------|
| Utils | Pure functions, transformations | Vitest |
| tRPC | Procedures, input validation | Vitest |
| Components | User interactions, rendering | RTL + Vitest |
| Pages | Critical user flows | Playwright |

### TDD Best Practices

- Write tests before implementation
- One assertion per test when possible
- Test behavior, not implementation details
- Keep tests fast and isolated
- Use descriptive test names: `it("should do X when Y")`
