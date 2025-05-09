// frontend/vite.config.js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    // Vitest configuration
    globals: true, // Allows using describe, it, expect etc. globally
    css: true,
    environment: "jsdom", // Use jsdom for browser-like environment
    setupFiles: ["./src/setupTests.js"], // Add vitest-preview setup
    // reporters: ['default', 'html'], // Optional: for HTML report
    // coverage: { // Optional: for coverage
    //   provider: 'v8', // or 'istanbul'
    //   reporter: ['text', 'json', 'html'],
    // },
  },
});
