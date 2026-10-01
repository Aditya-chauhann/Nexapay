import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 1007,
    hmr: {
      overlay: false,
    },
  },

  preview: {
    host: "::",
    port: 1007,
    allowedHosts: [
      "nexopay.exchange",
      "nexopay.live",
      "nexopay.pro",
      "nexopay.vip",
      "nexopay.com.co",
      "nexopay.digital",
      "nexopay.club",
      "nexopay.biz"
    ],
  },

  plugins: [
    react(),
    mode === "development" && componentTagger(),
  ].filter(Boolean),

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "@tanstack/react-query",
      "@tanstack/query-core",
    ],
  },
}));