import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import { readFileSync } from "node:fs"

const pkg = JSON.parse(readFileSync("./package.json", "utf8"))

// ── Tauri expects a fixed port, and WKWebView is Safari-based ───
export default defineConfig({
  plugins: [react()],
  // baked in at build time, so the running app knows its own version and repo
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __GITHUB_REPO__: JSON.stringify(pkg.githubRepo),
  },
  clearScreen: false,
  server: { port: 1420, strictPort: true },
  build: { target: "safari13" },
})
