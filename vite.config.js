import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const ROOT = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  appType: "mpa",
  build: {
    rollupOptions: {
      input: {
        home: path.join(ROOT, "index.html"),
        web: path.join(ROOT, "web", "index.html"),
        mobile: path.join(ROOT, "mobile", "index.html"),
      },
    },
  },
});
