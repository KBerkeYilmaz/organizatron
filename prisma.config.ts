import dotenv from "dotenv";
import { defineConfig } from "prisma/config";

// Load .env with override to handle conflicting shell env vars
dotenv.config({ override: true });

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    // Use DIRECT_URL for CLI commands (migrations, db push)
    url: process.env.DIRECT_URL!,
  },
});
