// open-next.config.ts
// Minimal config for Next.js on Cloudflare using @opennextjs/cloudflare (2026 compatible)

import type { OpenNextConfig } from "@opennextjs/cloudflare";

const config: OpenNextConfig = {
  default: {
    override: {
      wrapper: "cloudflare-node", // Required: Node.js compat wrapper
      converter: "edge", // Required: Handles request/response conversion
      proxyExternalRequest: "fetch", // Required: Use fetch for external calls (e.g., Supabase)
      incrementalCache: "dummy", // Disable caching (safe for your simple form app)
      tagCache: "dummy",
      queue: "dummy", // Or "direct" if you need queueing later
    },
  },
  middleware: {
    external: true,
    override: {
      wrapper: "cloudflare-edge",
      converter: "edge",
      proxyExternalRequest: "fetch",
      incrementalCache: "dummy",
      tagCache: "dummy",
      queue: "dummy",
    },
  },
  // Optional: Add if you use crypto or other node modules in edge contexts
  // edgeExternals: ["node:crypto"],
};

export default config;
