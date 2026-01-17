import { appRouter, createCaller } from "~/server/api/root";
import { prismaMock, type MockPrismaClient } from "./db-mock";

export function createTestCaller(db: MockPrismaClient = prismaMock) {
  return createCaller(() =>
    Promise.resolve({
      db,
      headers: new Headers(),
    })
  );
}

export { prismaMock };
export type TestCaller = ReturnType<typeof createTestCaller>;
