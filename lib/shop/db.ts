/*
 * The database (DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME in .env): the members app's MySQL (club-joia-300-backend, Prisma). Its tables
 * are the members app's own (users, members, memberships, tickets, ...). The shop's own tables
 * (orders, sign-in failures) are in the same database, named shop_<table>; the pre-registration
 * form's in pre_registrations. All made here on first use.
 * Note: Prisma's "migrate dev" in the members app takes tables it doesn't know as drift and offers
 * to reset the database; answer no there (on the live server "migrate deploy" doesn't check this).
 *
 * Queries are written with $1, $2, ... (a number may come twice) and "shop.<table>" for the shop's
 * tables; query() turns them into MySQL's ? and `shop_<table>`.
 * Sessions run in UTC: the members app's DATETIME columns are UTC (Prisma).
 */
import crypto from 'node:crypto';
import os from 'node:os';
import mysql, { type Pool, type PoolConnection } from 'mysql2/promise';

type Shared = { pool: Pool | null; key?: string; ready: Promise<void> | null; madeBy?: string; side?: Pool | null };
// one pool per server, also across the dev server's reloads
const shared: Shared = ((globalThis as unknown as { __cjShopMysql?: Shared }).__cjShopMysql ||= { pool: null, ready: null });

const SHOP_TABLES = ['orders', 'registration_attempts', 'rate_limits', 'locks', 'payment_logs'];

type Settings = { host: string; port: number; user: string; password: string; database: string };

function settings(): Settings {
  const e = process.env;
  const s = {
    host: e.DB_HOST || '127.0.0.1',
    port: Number(e.DB_PORT || 3306),
    user: e.DB_USER || '',
    password: e.DB_PASSWORD || '',
    database: e.DB_NAME || ''
  };
  if (!s.user || !s.database) throw new Error('DB_USER and DB_NAME are not set (.env)');
  return s;
}

function makePool(s: Settings, connectionLimit: number): Pool {
  const p = mysql.createPool({
    ...s,
    connectionLimit,
    charset: 'utf8mb4',
    timezone: 'Z',             // DATETIME <-> Date as UTC
    dateStrings: ['DATE'],     // a DATE stays 'YYYY-MM-DD'
    supportBigNumbers: true,
    enableKeepAlive: true
  });
  // NOW() and the columns' CURRENT_TIMESTAMP in UTC, as the members app stores them
  p.on('connection', function (c) {
    (c as unknown as { query(sql: string, cb: (e: Error | null) => void): void })
      .query("SET time_zone = '+00:00'", function (e) { if (e) console.error('[shop] database time zone:', e.message); });
  });
  return p;
}

function pool(): Pool {
  const s = settings();
  const key = JSON.stringify(s);
  // changed settings (the dev server reloads .env) get new pools
  if (shared.pool && shared.key !== key) {
    shared.pool.end().catch(function () {});
    if (shared.side) shared.side.end().catch(function () {});
    shared.pool = null;
    shared.side = null;
    shared.ready = null;
  }
  if (!shared.pool) {
    shared.key = key;
    shared.pool = makePool(s, 5);
  }
  return shared.pool;
}

// A second, small pool for single statements that may run while a transaction holds a connection
// of the main pool (the rate limits, lib/shop/limit.ts): with every main connection in a
// transaction waiting on them, sharing one pool would wait forever.
function sidePool(): Pool {
  pool();
  if (!shared.side) shared.side = makePool(settings(), 3);
  return shared.side;
}

// $n -> ? (with the parameters in that order), shop.<table> -> `shop_<table>`
const SHOP_RE = new RegExp('\\bshop\\.(' + SHOP_TABLES.join('|') + ')\\b', 'g');
export function toMysql(text: string, params: unknown[] = []): [string, unknown[]] {
  const out: unknown[] = [];
  const sql = text
    .replace(SHOP_RE, function (_, t) { return '`shop_' + t + '`'; })
    .replace(/\$(\d+)/g, function (_, n) { out.push(params[Number(n) - 1]); return '?'; });
  return [sql, out];
}

// rows of a SELECT; affectedRows of a change
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Result<R = any> = { rows: R[]; affectedRows: number; insertId?: number };
// the pool or a transaction's connection
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Db = { query<R = any>(text: string, params?: unknown[]): Promise<Result<R>> };

async function run<R>(on: Pool | PoolConnection, text: string, params?: unknown[]): Promise<Result<R>> {
  const [sql, values] = toMysql(text, params);
  // query, not execute: arrays expand for IN ($1)
  const [r] = await on.query(sql, values);
  if (Array.isArray(r)) return { rows: r as R[], affectedRows: 0 };
  const h = r as { affectedRows?: number; insertId?: number };
  return { rows: [], affectedRows: h.affectedRows || 0, insertId: h.insertId };
}

async function migrate(): Promise<void> {
  const tables = [
    `CREATE TABLE IF NOT EXISTS shop.orders (
      id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      ref              VARCHAR(64) NOT NULL,
      status           VARCHAR(20) NOT NULL DEFAULT 'pending',
      event_id         VARCHAR(191) NOT NULL,
      email            VARCHAR(191) NOT NULL,           -- buyer.email, for the unpaid-order limit
      ip               VARCHAR(64) NOT NULL DEFAULT '',  -- buyer.ip, the same
      buyer            JSON NOT NULL,
      items            JSON NOT NULL,
      amount           DECIMAL(12,2) NOT NULL,
      currency         CHAR(3) NOT NULL,
      telr_ref         VARCHAR(191) NULL,
      telr_url         VARCHAR(1000) NULL,
      telr_status      INT NULL,
      telr_create      JSON NULL,
      telr_check       JSON NULL,                       -- telr_*: orders paid before IFZA (direct Telr)
      pay_id           VARCHAR(191) NULL,               -- pay_*: the IFZA payment (lib/shop/ifza.ts)
      pay_status       VARCHAR(20) NULL,
      pay_init         JSON NULL,                       -- telr_init for the card fields
      pay_expires_at   DATETIME(3) NULL,
      pay_checkout_at  DATETIME(3) NULL,                -- card sent (checked out, once)
      pay_create       JSON NULL,
      pay_check        JSON NULL,
      member_id        VARCHAR(191) NULL,
      tickets          JSON NULL,                       -- the ticket numbers made
      error            TEXT NULL,
      retry_of         VARCHAR(64) NULL,                -- the order a retry came from
      created_at       DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at       DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      paid_at          DATETIME(3) NULL,
      fulfilled_at     DATETIME(3) NULL,
      failed_email_at  DATETIME(3) NULL,                -- "One more step to join us" sent (once)
      UNIQUE KEY orders_ref (ref),
      KEY orders_status_created (status, created_at),
      KEY orders_email (email, created_at),
      KEY orders_ip (ip, created_at),
      KEY orders_retry_of (retry_of),
      KEY orders_sweep (status, pay_checkout_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    // the pre-registration page (lib/preregister.ts): one row per submission, the same email may come again
    `CREATE TABLE IF NOT EXISTS pre_registrations (
      id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      email             VARCHAR(191) NOT NULL,
      first_name        VARCHAR(80) NOT NULL,
      last_name         VARCHAR(80) NOT NULL,
      phone             VARCHAR(32) NOT NULL,
      country           VARCHAR(80) NOT NULL,
      tier_interest     VARCHAR(20) NOT NULL,
      source            VARCHAR(120) NULL,
      message           TEXT NULL,
      marketing_opt_in  TINYINT(1) NOT NULL DEFAULT 0,
      consent_at        DATETIME(3) NOT NULL,
      ip_hash           CHAR(64) NULL,
      user_agent        VARCHAR(255) NULL,
      created_at        DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at        DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      KEY registrations_email (email),
      KEY registrations_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    // its spam limit: submissions per anonymised connection (never the IP address itself)
    `CREATE TABLE IF NOT EXISTS shop.registration_attempts (
      id       BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      ip_hash  CHAR(64) NOT NULL,
      at       DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      KEY registration_attempts_hash (ip_hash, at),
      KEY registration_attempts_at (at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    // fixed-window counters (lib/shop/limit.ts): one row per hashed key, counted atomically
    `CREATE TABLE IF NOT EXISTS shop.rate_limits (
      bucket        CHAR(64) NOT NULL PRIMARY KEY,
      count         INT NOT NULL,
      window_start  DATETIME(3) NOT NULL,
      KEY rate_limits_window (window_start)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    // every call to IFZA's payment API (lib/shop/ifza.ts): what was sent (card token hidden, never
    // the key) and IFZA's answer as it came, for checking a payment and for IFZA's support
    `CREATE TABLE IF NOT EXISTS shop.payment_logs (
      id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      call_name    VARCHAR(20) NOT NULL,             -- create, checkout or status
      reference    VARCHAR(64) NULL,                 -- the order's ref (create, and in IFZA's answers)
      payment_id   VARCHAR(191) NULL,                -- IFZA's payment id
      http_status  INT NULL,                         -- NULL: IFZA couldn't be reached (error says why)
      request      JSON NULL,
      response     MEDIUMTEXT NULL,
      error        VARCHAR(500) NULL,
      duration_ms  INT NULL,
      created_at   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      KEY payment_logs_reference (reference, created_at),
      KEY payment_logs_payment (payment_id, created_at),
      KEY payment_logs_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    // rows to lock: "stock" lets one order at a time past the stock check (lib/shop/orders.ts)
    `CREATE TABLE IF NOT EXISTS shop.locks (
      name  VARCHAR(64) NOT NULL PRIMARY KEY
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    "INSERT IGNORE INTO shop.locks (name) VALUES ('stock')"
  ];
  for (const sql of tables) await run(pool(), sql);
  // orders tables made before IFZA payments: add its columns
  const payCols = await run(pool(),
    "SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'shop_orders' AND column_name = 'pay_id' LIMIT 1");
  if (!payCols.rows.length) {
    await run(pool(), `ALTER TABLE shop.orders
      ADD COLUMN pay_id VARCHAR(191) NULL AFTER telr_check,
      ADD COLUMN pay_status VARCHAR(20) NULL AFTER pay_id,
      ADD COLUMN pay_init JSON NULL AFTER pay_status,
      ADD COLUMN pay_expires_at DATETIME(3) NULL AFTER pay_init,
      ADD COLUMN pay_checkout_at DATETIME(3) NULL AFTER pay_expires_at,
      ADD COLUMN pay_create JSON NULL AFTER pay_checkout_at,
      ADD COLUMN pay_check JSON NULL AFTER pay_create,
      ADD KEY orders_sweep (status, pay_checkout_at)`);
  }
  // tables made before one row per submission: email was unique there
  const unique = await run(pool(),
    "SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'pre_registrations' AND index_name = 'registrations_email' AND non_unique = 0 LIMIT 1");
  if (unique.rows.length) await run(pool(), 'ALTER TABLE pre_registrations DROP INDEX registrations_email, ADD INDEX registrations_email (email)');
}

// the shop's tables, made once per start
// (again when migrate() itself changed, as after a dev server reload)
function whenReady(): Promise<void> {
  const version = migrate.toString();
  if (!shared.ready || shared.madeBy !== version) {
    shared.madeBy = version;
    shared.ready = migrate().catch(function (e) { shared.ready = null; throw e; });
  }
  return shared.ready;
}

// makes the shop's tables now (npm run db:setup after a deploy), instead of on first use
export function setupTables(): Promise<void> {
  return whenReady();
}

export const db: Db = {
  async query(text, params) {
    await whenReady();
    return run(pool(), text, params);
  }
};

// single statements on the side pool (see sidePool): never inside a transaction
export const side: Db = {
  async query(text, params) {
    await whenReady();
    return run(sidePool(), text, params);
  }
};

// fn(connection) in one transaction
export async function transaction<T>(fn: (c: Db) => Promise<T>): Promise<T> {
  await whenReady();
  const conn = await pool().getConnection();
  const c: Db = { query: function (text, params) { return run(conn, text, params); } };
  try {
    await conn.beginTransaction();
    const result = await fn(c);
    await conn.commit();
    return result;
  } catch (e) {
    await conn.rollback().catch(function () {});
    throw e;
  } finally {
    conn.release();
  }
}

// a clash on a unique key
export function isDuplicate(e: unknown): boolean {
  return (e as { code?: string }).code === 'ER_DUP_ENTRY';
}

// for tests: closes the pool
export async function closeDb(): Promise<void> {
  const p = shared.pool;
  const q = shared.side;
  shared.pool = null;
  shared.side = null;
  shared.ready = null;
  if (p) await p.end();
  if (q) await q.end();
}

// ─── The members app's id and code formats (its src/lib/crypto and Prisma's cuid()) ───

const HUMAN = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

export function humanCode(length = 6): string {
  const bytes = crypto.randomBytes(length);
  let s = '';
  for (let i = 0; i < length; i++) s += HUMAN[bytes[i] % HUMAN.length];
  return s;
}

export function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('base64url');
}

// cuid v1 shape: c + time + counter + fingerprint + random, 25 characters
let counter = crypto.randomInt(1679616);
const host = os.hostname();
const fingerprint = process.pid.toString(36).slice(-2).padStart(2, '0') +
  host.split('').reduce(function (a, ch) { return a + ch.charCodeAt(0); }, host.length + 36).toString(36).slice(-2).padStart(2, '0');

export function cuid(): string {
  counter = (counter + 1) % 1679616;
  const random = crypto.randomBytes(8).readBigUInt64BE().toString(36).padStart(8, '0').slice(-8);
  return 'c' + Date.now().toString(36).padStart(8, '0') + counter.toString(36).padStart(4, '0') + fingerprint + random;
}
