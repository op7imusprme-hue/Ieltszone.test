import { randomPhone } from '@utils/random';

/** What the lead card form needs to move a lead into Call markaz. */
export type LeadData = {
  name: string;
  surname: string;
  phone: string;
  who: string;
  locale: string;
  gender: string;
  age: string;
  days: string;
  time: string;
  branch: string;
  course: string;
  subCourse: string;
};

/** A test lead with valid defaults; the phone starts with "000" so no real person gets an SMS. */
export function buildLead(overrides: Partial<LeadData> = {}): LeadData {
  return {
    name: `Autotest${Date.now().toString().slice(-6)}`,
    surname: 'Playwright',
    phone: randomPhone(),
    who: 'Talaba',
    locale: 'UZ',
    gender: 'Erkak',
    age: '20',
    days: 'Toq kunlar',
    time: '14:00 - 16:00',
    branch: 'Integro filial 11',
    course: 'General English',
    subCourse: 'Elementary',
    ...overrides,
  };
}

/** Birthday used when a lead is added to a group. */
export const STUDENT_BIRTHDAY = new Date(2006, 0, 15);
export const AUTOTEST_COMMENT = 'Playwright autotest';
