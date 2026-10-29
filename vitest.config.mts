import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('.', import.meta.url)) } },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Alfred is never called: tests/alfred-mock.ts answers instead
    env: { ALFRED_URL: 'http://alfred.test', ALFRED_EVENT_ID: '5263', ALFRED_VENDOR_ID: '462967' }
  }
});
