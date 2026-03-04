import {
  createCallerFactory,
  createTRPCRouter,
  publicProcedure,
} from "~/server/api/trpc";
import { activeTimerRouter } from "./routers/activeTimer";
import { aiRouter } from "./routers/ai";
import { clientRouter } from "./routers/client";
import { googleCalendarRouter } from "./routers/googleCalendar";
import { projectRouter } from "./routers/project";
import { statsRouter } from "./routers/stats";
import { taskRouter } from "./routers/task";
import { timeEntryRouter } from "./routers/timeEntry";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  health: publicProcedure.query(() => ({ status: "ok" })),
  activeTimer: activeTimerRouter,
  ai: aiRouter,
  clients: clientRouter,
  googleCalendar: googleCalendarRouter,
  project: projectRouter,
  stats: statsRouter,
  task: taskRouter,
  timeEntry: timeEntryRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 * @example
 * const trpc = createCaller(createContext);
 * const res = await trpc.post.all();
 *       ^? Post[]
 */
export const createCaller = createCallerFactory(appRouter);
