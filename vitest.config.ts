import { defineConfig } from "vitest/config";
import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import tsconfigPaths from "vite-tsconfig-paths";

// Tests run inside workerd against a real local D1 binding — so the
// conditional-insert guard, the sweeper and the quote engine are tested
// in the runtime they ship in, not a mock. Bindings come from wrangler.jsonc.
export default defineConfig({
  plugins: [
    tsconfigPaths(),
    cloudflareTest({
      wrangler: { configPath: "./wrangler.jsonc" },
    }),
  ],
  test: {
    include: ["app/**/*.test.ts"],
  },
});
