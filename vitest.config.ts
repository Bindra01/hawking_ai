import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    typecheck: {
      enabled: false,
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
    },
  },
});
