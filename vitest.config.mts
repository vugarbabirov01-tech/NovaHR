import "dotenv/config"
import { defineConfig } from "vitest/config"
import tsconfigPaths from "vite-tsconfig-paths"

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    // These tests share one real SQLite file (dev.db) via a single Prisma
    // client — SQLite serializes writes, so running multiple test files in
    // parallel worker processes (Vitest's default) causes genuine lock
    // contention and "Operation has timed out" failures, not just
    // slowness. Forcing single-file execution isn't a workaround for a
    // flaky suite; it's the correct concurrency model for tests that write
    // to a real, shared, single-writer database file.
    fileParallelism: false,
  },
})
