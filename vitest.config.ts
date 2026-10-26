import { cloudflareTest } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: "./wrangler.jsonc" },
      miniflare: {
        bindings: {
          OSU_OAUTH_CREDENTIALS: JSON.stringify([
            { clientId: "1", clientSecret: "test-secret-one" },
            { clientId: "2", clientSecret: "test-secret-two" },
          ]),
        },
      },
    }),
  ],
  test: {
    include: ["tests/**/*.test.ts"],
  },
});
