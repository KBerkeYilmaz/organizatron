import { createCaller } from "~/server/api/root";
import { prismaMock, type MockPrismaClient } from "./db-mock";

// Mock user for testing (Better Auth format)
const mockUser = {
  id: "test-user-id",
  email: "test@example.com",
  name: "Test User",
  emailVerified: true,
  image: null,
  createdAt: new Date(),
  updatedAt: new Date(),
} as const;

// Mock session for testing
const mockSession = {
  id: "test-session-id",
  userId: mockUser.id,
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
  token: "test-token",
  createdAt: new Date(),
  updatedAt: new Date(),
  ipAddress: null,
  userAgent: null,
};

export function createTestCaller(db: MockPrismaClient = prismaMock, user = mockUser as any) {
  return createCaller(() =>
    Promise.resolve({
      db,
      headers: new Headers(),
      user,
      session: { session: mockSession, user },
    })
  );
}

export function createUnauthenticatedTestCaller(db: MockPrismaClient = prismaMock) {
  return createCaller(() =>
    Promise.resolve({
      db,
      headers: new Headers(),
      user: null,
      session: null,
    })
  );
}

export { prismaMock };
export type TestCaller = ReturnType<typeof createTestCaller>;
