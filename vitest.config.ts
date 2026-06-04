import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    // Project root is the user's home dir; scope test discovery to project
    // folders only so Vitest never scans the entire home tree.
    include: ['{app,components,lib}/**/*.{test,spec}.{ts,tsx}'],
    passWithNoTests: true,
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
});
