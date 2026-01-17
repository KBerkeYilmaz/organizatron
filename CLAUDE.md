# Organizatron

AI-powered task organizer and time tracker with intelligent scheduling.

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
- **Database**: PostgreSQL via Prisma ORM
- **Backend**: Supabase (auth, storage, realtime)
- **API Layer**: tRPC with React Query
- **Auth**: Better Auth
- **Deployment**: AWS (target platform)
- **AI**: Claude API for intelligent features

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
├── app/              # Next.js App Router pages
├── components/       # React components
│   └── ui/           # shadcn/ui components
├── lib/              # Utilities and configurations
├── server/           # tRPC routers and server logic
├── styles/           # Global styles
└── trpc/             # tRPC client setup
prisma/
└── schema.prisma     # Database schema
e2e/                  # Playwright E2E tests
```

## Key Integrations (Planned)

1. **Google Calendar API** - For task scheduling
2. **Supabase** - Backend services (auth, db, storage)
3. **AWS Services** - Deployment and serverless functions
4. **Claude API** - AI-powered suggestions and task analysis

## Development Guidelines

- Use server components by default, client components only when needed
- Validate all inputs with Zod schemas
- Use tRPC for type-safe API calls
- Follow existing code patterns in the codebase

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
├── components/
│   ├── Button.tsx
│   └── Button.test.tsx   # Component tests (colocated)
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
