import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "node:crypto";

/**
 * Time-based one-time passwords (RFC 6238: HMAC-SHA1, 30-second steps, 6 digits), the codes of
 * Google Authenticator, Microsoft Authenticator, 1Password and the like.
 *
 * A copy of club-joia-300-backend's src/lib/security/totp.ts: the sales dashboard (/admin) checks
 * the codes of the members app's admin accounts, which they set up in the members app's staff
 * portal. Keep the two copies identical apart from this comment.
 *
 * Secrets are stored encrypted (AES-256-GCM) with a key derived from MFA_ENCRYPTION_KEY, which
 * both apps must share.
 */

export const TOTP_STEP_SECONDS = 30;
export const TOTP_DIGITS = 6;
/** Steps accepted either side of now, for a phone clock that is a little off. */
const TOTP_WINDOW = 1;

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(bytes: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(text: string): Buffer {
  const clean = text.toUpperCase().replace(/[\s=-]/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const i = BASE32.indexOf(ch);
    if (i < 0) throw new Error("Invalid base32 secret");
    value = (value << 5) | i;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** A new secret: 160 random bits, base32 (what authenticator apps expect). */
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

/** The time step a moment falls in. */
export function totpStep(nowMs = Date.now()): number {
  return Math.floor(nowMs / 1000 / TOTP_STEP_SECONDS);
}

/** The code of one time step (RFC 4226 dynamic truncation). */
export function totpCode(secret: string, step: number): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const mac = createHmac("sha1", base32Decode(secret)).update(counter).digest();
  const offset = mac[mac.length - 1] & 15;
  const number = (mac.readUInt32BE(offset) & 0x7fffffff) % 10 ** TOTP_DIGITS;
  return String(number).padStart(TOTP_DIGITS, "0");
}

/**
 * The time step a code belongs to, or null when it matches none near now. The caller stores the
 * step and refuses it (and older ones) afterwards, so a code works only once.
 */
export function matchTotp(secret: string, code: string, nowMs = Date.now()): number | null {
  const digits = String(code).replace(/\s/g, "");
  if (!new RegExp(`^\\d{${TOTP_DIGITS}}$`).test(digits)) return null;
  const now = totpStep(nowMs);
  let found: number | null = null;
  // Check every step in the window (no early exit), so timing doesn't tell which one matched.
  for (let step = now - TOTP_WINDOW; step <= now + TOTP_WINDOW; step++) {
    const expected = totpCode(secret, step);
    let diff = 0;
    for (let i = 0; i < TOTP_DIGITS; i++) diff |= expected.charCodeAt(i) ^ digits.charCodeAt(i);
    if (diff === 0 && found === null) found = step;
  }
  return found;
}

/** otpauth:// address for the QR code an authenticator app scans. */
export function totpUri(secret: string, account: string, issuer = "CLUB JOIA 300"): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const params = new URLSearchParams({ secret, issuer, algorithm: "SHA1", digits: String(TOTP_DIGITS), period: String(TOTP_STEP_SECONDS) });
  return `otpauth://totp/${label}?${params.toString()}`;
}

// ─── Secret at rest ──────────────────────────────────────────────────────────

function keyFrom(material: string): Buffer {
  if (!material || material.length < 32) throw new Error("MFA_ENCRYPTION_KEY must be at least 32 characters");
  return createHash("sha256").update(material).digest();
}

/** "v1.<iv>.<tag>.<ciphertext>", base64url parts. */
export function encryptTotpSecret(secret: string, keyMaterial: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyFrom(keyMaterial), iv);
  const data = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), data.toString("base64url")].join(".");
}

export function decryptTotpSecret(blob: string, keyMaterial: string): string {
  const [version, iv, tag, data] = String(blob).split(".");
  if (version !== "v1" || !iv || !tag || !data) throw new Error("Unknown MFA secret format");
  const decipher = createDecipheriv("aes-256-gcm", keyFrom(keyMaterial), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
}
