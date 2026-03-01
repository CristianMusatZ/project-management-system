/**
 * TOTP (Time-based One-Time Password) — RFC 6238
 * Implementare nativă Node.js folosind doar modulul crypto built-in.
 * Compatibil cu Google Authenticator, Authy, Microsoft Authenticator.
 */
import crypto from 'crypto';

// ─────────────────────────────────────────────────────────────────────────────
// Secret generation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generează un secret aleator Base32 de 20 bytes (160 biți).
 * Lungime standard recomandată pentru TOTP.
 */
export function generateSecret(): string {
  const bytes = crypto.randomBytes(20);
  return base32Encode(bytes);
}

// ─────────────────────────────────────────────────────────────────────────────
// Base32 encoding (RFC 4648) — necesar pentru compatibilitate cu Authenticator
// ─────────────────────────────────────────────────────────────────────────────

const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(buf: Buffer): string {
  let result = '';
  let bits = 0;
  let value = 0;

  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      result += BASE32_CHARS[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    result += BASE32_CHARS[(value << (5 - bits)) & 31];
  }
  return result;
}

function base32Decode(str: string): Buffer {
  const s = str.toUpperCase().replace(/=+$/, '');
  const bytes: number[] = [];
  let bits = 0;
  let value = 0;

  for (const char of s) {
    const idx = BASE32_CHARS.indexOf(char);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

// ─────────────────────────────────────────────────────────────────────────────
// HOTP (HMAC-based OTP) — RFC 4226
// ─────────────────────────────────────────────────────────────────────────────

function hotp(secret: string, counter: number): string {
  const key = base32Decode(secret);

  // Counter ca buffer big-endian de 8 bytes
  const counterBuf = Buffer.alloc(8);
  const hi = Math.floor(counter / 0x100000000);
  const lo = counter >>> 0;
  counterBuf.writeUInt32BE(hi, 0);
  counterBuf.writeUInt32BE(lo, 4);

  // HMAC-SHA1
  const hmac = crypto.createHmac('sha1', key).update(counterBuf).digest();

  // Dynamic truncation
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  return String(code % 1_000_000).padStart(6, '0');
}

// ─────────────────────────────────────────────────────────────────────────────
// TOTP (Time-based OTP) — RFC 6238
// ─────────────────────────────────────────────────────────────────────────────

const STEP = 30; // fereastră de 30 secunde (standard)

function getTimeStep(time = Date.now()): number {
  return Math.floor(time / 1000 / STEP);
}

/**
 * Generează codul TOTP curent pentru un secret dat.
 */
export function generateTOTP(secret: string): string {
  return hotp(secret, getTimeStep());
}

/**
 * Verifică un cod TOTP — acceptă fereastra curentă ± 1 pas (±30s)
 * pentru a compensa diferențe mici de ceas.
 */
export function verifyTOTP(secret: string, code: string): boolean {
  if (!/^\d{6}$/.test(code)) return false;
  const step = getTimeStep();
  // Verificăm pasul anterior, curent și următor (toleranță ±30s)
  for (const delta of [-1, 0, 1]) {
    if (hotp(secret, step + delta) === code) return true;
  }
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// QR Code URI (otpauth://) — pentru scanare cu Authenticator apps
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generează URI-ul otpauth:// care poate fi transformat în QR code pe frontend.
 * Format: otpauth://totp/ISSUER:EMAIL?secret=SECRET&issuer=ISSUER&algorithm=SHA1&digits=6&period=30
 */
export function getTOTPUri(secret: string, email: string, issuer = 'PMS'): string {
  const label = encodeURIComponent(`${issuer}:${email}`);
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: 'SHA1',
    digits: '6',
    period: String(STEP),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}
