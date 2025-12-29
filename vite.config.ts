import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Explicitly disable any PWA plugin if auto-detected
  ],
  build: {
    // Optional: help with build stability
    outDir: 'dist',
    sourcemap: false,
  },
});