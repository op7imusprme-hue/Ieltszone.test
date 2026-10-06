const pad = (n: number) => String(n).padStart(2, '0');

/** yyyy-mm-dd (v-calendar day ids). */
export function isoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** dd.mm.yyyy as shown in the admin UI. */
export function uiDate(d: Date): string {
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
}

/** Today + n days. */
export function addDays(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}
