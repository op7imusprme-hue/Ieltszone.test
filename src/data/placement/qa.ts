/** Placement tests created by the functional suite start with "AT-QA" (and are deleted after each test). */
export const stamp = () => new Date().toISOString().slice(5, 19).replace('T', ' ');
export const qaTitle = (name: string) => `AT-QA ${name} ${stamp()}`;

/** An id that does not exist (placement test / lead). */
export const MISSING_ID = '99999999';
