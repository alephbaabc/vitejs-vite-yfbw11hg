import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Sentinel V8 Gold',
        short_name: 'SentinelV8',
        description: 'Professional PAXG Volatility Engine',
        theme_color: '#050505',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
        ],
        display: 'standalone', // This removes the browser URL bar
      },
    }),
  ],
});
