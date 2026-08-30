import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import svgr from "vite-plugin-svgr";

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    svgr({
      svgrOptions: {
        icon: true,
        exportType: "named",
        namedExport: "ReactComponent",
      },
      // The default include glob ("**/*.svg?react") only matches when the
      // query string is *exactly* "?react". Vite's import-analysis can
      // rewrite that to "?import&react" before svgr's load() hook ever
      // sees it, which the default glob then fails to match - svgr skips
      // the file, and Vite's own asset loader serves it as a plain URL
      // (no `ReactComponent` export). Matching on "react" appearing
      // anywhere in the query is more tolerant of that rewrite.
      include: /\.svg\?.*react/,
    }),
  ],
  define: {
    // Dev:  API at localhost:3000
    // Prod: API on same domain at /api (served by Express on same port)
    'import.meta.env.VITE_API_URL': mode === 'production'
      ? JSON.stringify('/api')
      : JSON.stringify('http://localhost:3000/api'),
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom", "react-router"],
          axios: ["axios"],
        },
      },
    },
  },
  base: "/",
}));
