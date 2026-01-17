import { test, expect } from "@playwright/test";

test.describe("Application Health", () => {
  test("homepage loads successfully", async ({ page }) => {
    await page.goto("/");

    // Check that the page loaded (adjust selector based on your app)
    await expect(page).toHaveTitle(/Organizatron/i);
  });

  test("tRPC health endpoint responds", async ({ request }) => {
    // Test the health check via tRPC
    const response = await request.get("/api/trpc/health");

    expect(response.ok()).toBeTruthy();
  });
});
