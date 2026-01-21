import "@testing-library/dom";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Set test environment variables before any imports
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
process.env.BETTER_AUTH_SECRET = "test-secret-that-is-at-least-32-characters-long";
process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";

// Cleanup after each test
afterEach(() => {
  cleanup();
});
