// open-next.config.ts
// Minimal config for a standard Next.js app on Cloudflare (using Node.js runtime compatibility)

import type { OpenNextConfig } from "@opennextjs/cloudflare";

const config: OpenNextConfig = {
  default: {
    override: {
      wrapper: "cloudflare-node", // Use Node.js-compatible wrapper
      converter: "edge", // Convert requests/responses for edge-like handling
      proxyExternalRequest: "fetch", // Use fetch for external calls
      incrementalCache: "dummy", // Disable advanced caching (dummy = no cache, safe for simple apps)
      tagCache: "dummy",
      queue: "dummy",
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
  // Optional: If you have edge externals or other tweaks, add here
  // edgeExternals: ["node:crypto"], // Example if needed
};

export default config;
