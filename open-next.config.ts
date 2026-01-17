// open-next.config.ts
// This uses the defineCloudflareConfig helper from the adapter (required for validation)

import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig({
  default: {
    override: {
      wrapper: "cloudflare-node", // Node.js compat for server functions
      converter: "edge", // Required for request/response handling
      proxyExternalRequest: "fetch", // For external calls like Supabase
      incrementalCache: "dummy", // Disable caching (safe for your app)
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
});
