import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const root = fileURLToPath(new URL(".", import.meta.url));
const testDatabaseUrl = process.env.TEST_DATABASE_URL;

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@\//, replacement: root },
      // "server-only" throws outside Next's server bundle, so tests load an empty module instead
      { find: "server-only", replacement: `${root}test/empty.ts` },
    ],
  },
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    // The database tests only ever use TEST_DATABASE_URL, never the DATABASE_URL in .env
    env: testDatabaseUrl ? { DATABASE_URL: testDatabaseUrl } : {},
  },
});
