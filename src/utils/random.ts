/**
 * Fake phone in the site's mask format (##) ###-##-## → 9 digits.
 * Starts with "000" so it can never belong to a real person (the site sends SMS to leads).
 */
export function randomPhone(): string {
  return '000' + String(Math.floor(100_000 + Math.random() * 899_999));
}

/** Random integer in [0, max). */
export function randomInt(max: number): number {
  return Math.floor(Math.random() * max);
}
