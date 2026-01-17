// open-next.config.ts
// Minimal config to satisfy @opennextjs/cloudflare validation (2026)

export default {
  default: {}, // Required: At least empty object here to pass check
  // Optional defaults (dummy to disable advanced features your app doesn't need)
  incrementalCache: "dummy",
  tagCache: "dummy",
  queue: "dummy",
};
