/**
 * Correct answers of the "Demo test uchun" placement test (question prompt → correct option).
 * Sections in order: each one is a level; a section is passed with ≥ 4 of 5 correct (80%).
 * The student's level is the first section that is not passed.
 */
export const DEMO_TEST_TITLE = 'Demo test uchun';

export const DEMO_TEST_LEVELS = [
  'Beginner',
  'Elementary',
  'Pre-Intermediate',
  'Intermediate',
  'IELTS Novice',
  'IELTS Standard',
];

export const DEMO_TEST_ANSWERS: Record<string, string> = {
  // A1 — Beginner
  "I can't understand this email.": 'Would you like some help?',
  'Hello, what is your name?': 'My name is Sarah.',
  'Where are you from? [A1]': "I'm from Japan.",
  'Do you like coffee? [A1]': 'Yes, I do.',
  'What time is it? [A1]': "It's two o'clock.",
  // A2 — Elementary
  'Can I park here?': 'Only for half an hour.',
  "What colour will you paint the children's bedroom?": "We can't decide.",
  "I'd like two tickets for tomorrow night.": "I'll just check for you.",
  'Shall we go to the gym now?': "I'm too tired.",
  'What time does the train leave?': 'In ten minutes.',
  // B1 — Pre-Intermediate
  "His eyes were ______ bad that he couldn't read the number plate of the car in front.": 'so',
  "Don't put your cup on the ______ of the table - someone will knock it off.": 'edge',
  "I'm sorry - I didn't ______ to disturb you.": 'mean',
  "The shop didn't have the shoes I wanted, but they've ______ a pair specially for me.": 'ordered',
  'I left my last job because I had no ______ to travel.': 'opportunity',
  // B1+ — Intermediate
  'If I ______ known you were coming, I would have baked a cake.': 'had',
  'We decided to put ______ the meeting until next Tuesday.': 'off',
  'She’s lived in London for five years, so she is used to ______ on the left.': 'driving',
  'Although it was raining heavily, they ______ playing football.': 'carried on',
  'He asked me where ______ my holidays the previous summer.': 'I had spent',
  // B2 — IELTS Novice
  'Would you mind ______ these plates a wipe before putting them in the cupboard?': 'giving',
  '______ tired Melissa is when she gets home from work, she always makes time to say goodnight to the children.':
    'No matter how',
  'It was only ten days ago ______ she started her new job.': 'that',
  "I'd rather you ______ to her why we can't go.": 'explained',
  'This new printer is recommended as being ______ reliable.': 'highly',
  // C1 — IELTS Standard
  'When I realised I had dropped my gloves, I decided to ______ my steps.': 'retrace',
  "Anne's house is somewhere in the ______ of the railway station.": 'vicinity',
  "The company's financial state is so precarious that it is on the ______ of bankruptcy.": 'verge',
  'Her speech was so compelling that it ______ a standing ovation from the entire audience.': 'elicited',
  'The new legislation is intended to ______ the loopholes in the existing tax system': 'plug',
};
