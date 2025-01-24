#!/usr/bin/env node
import { run } from "./server.js";

// Main entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  run().catch((error) => {
    console.error("Failed to start server:", error);
    process.exit(1);
  });
}

export { run };
