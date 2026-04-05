import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), tsconfigPaths()],
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, '../shared'),
      '@worker': path.resolve(__dirname, '../worker/src'),
      '@client': path.resolve(__dirname, './src'),
      '@api': path.resolve(__dirname, '../api/src'),
    },
  },
  server: {
    port: 4040,
  },
});
