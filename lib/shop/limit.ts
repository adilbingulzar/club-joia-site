/*
 * Fixed-window rate limits on the database (shop.rate_limits), shared by every server process and
 * kept over restarts.
 *
 * One statement per hit: an upsert that also hands back the new count (LAST_INSERT_ID(expr) sets
 * the statement's insert id). The row is locked while the statement runs, so hits at the same
 * moment queue up and each gets its own count: no more than `limit` get through, however many
 * arrive at once. It runs on the side pool (lib/shop/db.ts), so a limit checked while a
 * transaction holds a connection (a payment being made) never waits for that connection.
 * Keys are stored hashed (no email, address or order number in the table).
 */
import crypto from 'node:crypto';
import { side } from './db';

function hash(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

// one hit on a key: allowed while the window's count is at most `limit`
export async function hit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const r = await side.query(
    `INSERT INTO shop.rate_limits (bucket, count, window_start) VALUES ($1, LAST_INSERT_ID(1), NOW(3))
     ON DUPLICATE KEY UPDATE
       count = LAST_INSERT_ID(IF(window_start < NOW(3) - INTERVAL $2 SECOND, 1, count + 1)),
       window_start = IF(window_start < NOW(3) - INTERVAL $2 SECOND, NOW(3), window_start)`,
    [hash(key), windowSeconds]
  );
  const count = Number(r.insertId);
  if (!count) throw new Error('rate limit: no count for ' + key.split(':')[0]);
  // now and then, the windows long over
  if (Math.random() < 0.01) await side.query('DELETE FROM shop.rate_limits WHERE window_start < NOW(3) - INTERVAL 2 DAY').catch(function () {});
  return count <= limit;
}
