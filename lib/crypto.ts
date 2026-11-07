import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

export function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

/** 存储格式：scrypt$<salt-hex>$<derived-hex> */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const derived = scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

export function verifyPassword(password: string, stored: string | null | undefined): boolean {
  if (!stored) return false;
  const parts = stored.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const salt = parts[1];
  const expected = parts[2];
  const derived = scryptSync(password, salt, 64).toString('hex');
  return safeEqualHex(derived, expected);
}

/** 定长十六进制字符串的常量时间比较 */
export function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const bufA = Buffer.from(a, 'hex');
  const bufB = Buffer.from(b, 'hex');
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
