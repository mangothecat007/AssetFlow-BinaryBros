import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom"],
  },
  optimizeDeps: {
    include: ["react/jsx-runtime"],
  },
  build: {
    sourcemap: false,
    minify: "oxc",
  },



  server: {
    //  proxy: {
    //   "/api": {
    //     target: "http://localhost:8082",
    //     changeOrigin: true,
    //     ws: true,
    //   },
  },
  //  headers: {
  //   "Cross-Origin-Opener-Policy": "same-origin",
  //   "Cross-Origin-Embedder-Policy": "require-corp"
  //  },

});
