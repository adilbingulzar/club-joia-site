import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('.', import.meta.url)) } },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // the shop's functions are faked by tests/shop-mock.ts (tests/shop.test.ts uses the real ones on a database)
    env: { SHOP_EVENT: 'abu-dhabi-2026', SHOP_SITE_URL: 'http://site.test', SHOP_ADMIN_KEY: 'unit-test-shop-key-0123456789' }
  }
});
