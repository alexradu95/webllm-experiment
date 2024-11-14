import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import mkcert from 'vite-plugin-mkcert';

export default defineConfig({
  plugins: [
    react({
      // Add React Refresh options
      fastRefresh: true,
      // Include all .jsx? and .tsx? files
      include: "**/*.{jsx,tsx,js,ts}",
    }),
    mkcert()
  ],
  resolve: {
    alias: {
      '@': '/src'
    }
  },
  server: {
    https: true,
    port: 3000,
    hot: true
  },
  build: {
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'transformers': ['@huggingface/transformers']
        }
      }
    }
  }
});
