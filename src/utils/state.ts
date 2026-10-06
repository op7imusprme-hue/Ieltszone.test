import fs from 'fs';
import path from 'path';
import { paths } from '@config/env';

/**
 * Small JSON files a run leaves for the next one (kept in .state/, not committed):
 * e.g. the placement test created by one spec and used by another, or a name counter.
 */
export const state = {
  file: (name: string) => path.join(paths.state, `${name}.json`),

  read<T>(name: string): T | undefined {
    try {
      return JSON.parse(fs.readFileSync(this.file(name), 'utf8')) as T;
    } catch {
      return undefined;
    }
  },

  write(name: string, value: unknown) {
    fs.mkdirSync(paths.state, { recursive: true });
    fs.writeFileSync(this.file(name), JSON.stringify(value, null, 2) + '\n');
  },

  /** Next value of a persistent counter: 1, 2, 3, ... */
  next(name: string): number {
    const last = this.read<{ last: number }>(name)?.last ?? 0;
    this.write(name, { last: last + 1 });
    return last + 1;
  },
};
