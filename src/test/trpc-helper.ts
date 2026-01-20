import { appRouter, createCaller } from "~/server/api/root";
import { prismaMock, type MockPrismaClient } from "./db-mock";

// Mock user for testing
const mockUser = {
  id: "test-user-id",
  email: "test@example.com",
  aud: "authenticated",
  role: "authenticated",
  created_at: new Date().toISOString(),
  app_metadata: {},
  user_metadata: {},
} as const;

// Mock Supabase client for testing
const mockSupabase = {
  auth: {
    getUser: () => Promise.resolve({ data: { user: mockUser }, error: null }),
    getSession: () => Promise.resolve({ data: { session: null }, error: null }),
  },
} as any;

export function createTestCaller(db: MockPrismaClient = prismaMock, user = mockUser as any) {
  return createCaller(() =>
    Promise.resolve({
      db,
      headers: new Headers(),
      user,
      supabase: mockSupabase,
    })
  );
}

export function createUnauthenticatedTestCaller(db: MockPrismaClient = prismaMock) {
  return createCaller(() =>
    Promise.resolve({
      db,
      headers: new Headers(),
      user: null,
      supabase: mockSupabase,
    })
  );
}

export { prismaMock };
export type TestCaller = ReturnType<typeof createTestCaller>;
