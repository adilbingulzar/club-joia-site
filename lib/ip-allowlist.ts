/*
 * IP allowlist (proxy.ts): with IP_ALLOWLIST set, every request (pages, APIs, files, the ticket
 * shop's routes, Telr's callbacks) from an address outside it gets 403. Empty or unset: off.
 *
 *   IP_ALLOWLIST="127.0.0.1, ::1, 203.0.113.7, 10.0.0.0/8, 2001:db8::/32"
 *
 * The same file is in club-joia-300-backend (src/lib/security/ip-allowlist.ts).
 *
 * The visitor's address is the LAST entry of X-Forwarded-For: the one the server's own reverse
 * proxy (nginx) added, whether it overwrites the header ($remote_addr) or appends to it
 * ($proxy_add_x_forwarded_for). Next.js keeps a header the client sent, so the app must only be
 * reachable through nginx (listen on 127.0.0.1), or a client could send any address.
 */

type Range = { v6: boolean; base: bigint; bits: number };

function v4(text: string): bigint | null {
  const parts = text.split('.');
  if (parts.length !== 4) return null;
  let n = BigInt(0);
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p) || Number(p) > 255) return null;
    n = (n << BigInt(8)) + BigInt(Number(p));
  }
  return n;
}

function v6(text: string): bigint | null {
  let s = text.toLowerCase();
  // ::ffff:1.2.3.4 and other forms ending in an IPv4 address
  const tail = /(\d+\.\d+\.\d+\.\d+)$/.exec(s);
  if (tail) {
    const four = v4(tail[1]);
    if (four === null) return null;
    s = s.slice(0, -tail[1].length) + (four >> BigInt(16)).toString(16) + ':' + (four & BigInt(0xffff)).toString(16);
  }
  const halves = s.split('::');
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(':') : [];
  const rest = halves.length === 2 ? (halves[1] ? halves[1].split(':') : []) : [];
  const missing = 8 - head.length - rest.length;
  if (halves.length === 1 ? head.length !== 8 : missing < 1) return null;
  const groups = head.concat(Array(halves.length === 2 ? missing : 0).fill('0'), rest);
  let n = BigInt(0);
  for (const g of groups) {
    if (!/^[0-9a-f]{1,4}$/.test(g)) return null;
    n = (n << BigInt(16)) + BigInt(parseInt(g, 16));
  }
  return n;
}

// an address as { v6, value }; IPv4-mapped IPv6 (::ffff:1.2.3.4) counts as the IPv4 address
function parse(text: string): { v6: boolean; value: bigint } | null {
  const t = text.trim().replace(/^\[|\]$/g, '').replace(/%.*$/, '');
  const four = v4(t);
  if (four !== null) return { v6: false, value: four };
  const six = v6(t);
  if (six === null) return null;
  if (six >> BigInt(32) === BigInt(0xffff)) return { v6: false, value: six & BigInt(0xffffffff) };
  return { v6: true, value: six };
}

export function parseAllowlist(text: string | undefined): Range[] {
  const out: Range[] = [];
  String(text || '').split(/[\s,]+/).filter(Boolean).forEach(function (entry) {
    const [addr, len] = entry.split('/');
    const a = parse(addr);
    if (!a) { console.error('[ip-allowlist] ignored "' + entry + '": not an IP address'); return; }
    const max = a.v6 ? 128 : 32;
    const bits = len === undefined ? max : Number(len);
    if (!Number.isInteger(bits) || bits < 0 || bits > max) { console.error('[ip-allowlist] ignored "' + entry + '": bad prefix length'); return; }
    const shift = BigInt(max - bits);
    out.push({ v6: a.v6, base: (a.value >> shift) << shift, bits });
  });
  return out;
}

export function allowed(ip: string, ranges: Range[]): boolean {
  const a = parse(ip);
  if (!a) return false;
  return ranges.some(function (r) {
    if (r.v6 !== a.v6) return false;
    const shift = BigInt((r.v6 ? 128 : 32) - r.bits);
    return (a.value >> shift) << shift === r.base;
  });
}

// the visitor's address, see above. No X-Real-IP fallback: Next.js always sets X-Forwarded-For
// (from the connection) unless the client sent one, so an empty one is the client's own doing.
export function clientIp(headers: Headers): string {
  const forwarded = (headers.get('x-forwarded-for') || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
  return forwarded[forwarded.length - 1] || '';
}

let cache: { text: string; ranges: Range[] } | null = null;

// null when the allowlist is off, else whether the request may pass
export function allowlistVerdict(headers: Headers, env: string | undefined = process.env.IP_ALLOWLIST): boolean | null {
  const text = String(env || '').trim();
  if (!text) return null;
  if (!cache || cache.text !== text) cache = { text, ranges: parseAllowlist(text) };
  return allowed(clientIp(headers), cache.ranges);
}
