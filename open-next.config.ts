// open-next.config.ts
import { type OpenNextConfig } from "@opennextjs/cloudflare";

const config: OpenNextConfig = {
  // Use the default settings for most Next.js apps
  default: {
    // This tells OpenNext to build for Cloudflare Workers/Pages
    target: "cloudflare-pages",
  },
};

export default config;
