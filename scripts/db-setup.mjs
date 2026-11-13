/*
 * Makes the site's own tables in the database of .env (DB_*), if missing: shop_orders,
 * pre_registrations, shop_registration_attempts, shop_rate_limits, shop_payment_logs, shop_locks. Never drops or empties a table.
 * Run once after a deploy:  npm run db:setup
 * (The site also makes them on its first database use.) Needs Node 22.18 or newer: it runs
 * lib/shop/db.ts as it is.
 */
import fs from 'node:fs';

// .env, without overriding what the environment already sets
if (fs.existsSync('.env')) process.loadEnvFile('.env');

const { setupTables, closeDb } = await import('../lib/shop/db.ts');
const name = (process.env.DB_USER || '?') + '@' + (process.env.DB_HOST || '127.0.0.1') + '/' + (process.env.DB_NAME || '?');
try {
  await setupTables();
  console.log('db:setup: the tables are there in ' + name);
} catch (e) {
  console.error('db:setup: failed for ' + name + ': ' + (e && e.message));
  process.exitCode = 1;
} finally {
  await closeDb().catch(function () {});
}
