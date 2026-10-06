import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');

// Local secrets (IZ_EMAIL, IZ_PASSWORD) live in .env, which is never committed
const dotenv = path.join(ROOT, '.env');
if (fs.existsSync(dotenv)) process.loadEnvFile(dotenv);

export const env = {
  /** Admin panel (CRM). */
  baseUrl: process.env.BASE_URL ?? 'https://demo-main.ieltszoneapp.uz',
  /** Public site where a lead takes the placement test. */
  placementUrl: process.env.PLACEMENT_URL ?? 'https://demo.ieltszoneapp.uz/placement-test',
  email: process.env.IZ_EMAIL,
  password: process.env.IZ_PASSWORD,
} as const;

export const paths = {
  root: ROOT,
  /** Logged-in CEO session, written by tests/setup/auth.setup.ts. */
  storageState: path.join(ROOT, '.auth', 'ceo.json'),
  /** Data that one run leaves for the next one (not committed). */
  state: path.join(ROOT, '.state'),
} as const;
