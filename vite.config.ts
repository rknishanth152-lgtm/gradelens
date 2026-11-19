/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  // GitHub Pages serves the site from /gradelens/; everywhere else (dev, Vercel, Netlify) uses /.
  base: process.env.GITHUB_PAGES ? '/gradelens/' : '/',
  plugins: [react(), tailwindcss()],
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1500,
  },
  test: {
    include: ['src/tests/**/*.test.ts'],
    environment: 'node',
  },
});
