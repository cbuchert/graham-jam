import { resolve } from "node:path"
import type { Plugin } from "vite"
import { defineConfig } from "vite"

/** Redirect /editor and /editor/tile-editor (no trailing slash) to trailing-slash URLs so MPA serves the correct HTML. */
function redirectEditorPaths(): Plugin {
  return {
    name: "redirect-editor-paths",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url === "/editor" && req.method === "GET") {
          res.writeHead(302, { Location: "/editor/" })
          res.end()
          return
        }
        if (req.url === "/editor/tile-editor" && req.method === "GET") {
          res.writeHead(302, { Location: "/editor/tile-editor/" })
          res.end()
          return
        }
        next()
      })
    },
  }
}

export default defineConfig({
  appType: "mpa",
  plugins: [redirectEditorPaths()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        editor: resolve(__dirname, "editor/index.html"),
        tileEditor: resolve(__dirname, "editor/tile-editor/index.html"),
      },
    },
  },
  test: {
    environment: "node",
  },
})
