import path from 'path';

/**
 * Questions of the placement test created by `new-placement-test.spec.ts`.
 * One section per level (Beginner → IELTS Standart), 5 multiple-choice questions each.
 * `answer` is the correct option — it gets the green check (radio) in the admin editor
 * and is saved as ">> answer" so it is visible while taking the test.
 * A section is passed with ≥ 4 of 5 correct (80%); the level is the first section that is not passed.
 */
export const CORRECT_MARK = '>> ';

/** The last test created by `new-placement-test.spec.ts`: { id, title }. */
export const NEW_PLACEMENT_FILE = path.join(__dirname, '..', 'new-placement-test.json');

export type PlacementQuestion = { text: string; options: string[]; answer: string };
/** level: name in the admin Level dropdown, result: the (English) name shown as the student's level after the test */
export type PlacementSection = { title: string; level: string; result: string; questions: PlacementQuestion[] };

export const NEW_PLACEMENT_SECTIONS: PlacementSection[] = [
  {
    title: 'A1 Beginner',
    level: 'Beginner',
    result: 'Beginner',
    questions: [
      { text: 'She ______ a teacher.', options: ['am', 'is', 'are', 'be'], answer: 'is' },
      { text: 'How old are you?', options: ["I'm fine.", "I'm 25.", "I'm a student.", "I'm from Spain."], answer: "I'm 25." },
      { text: 'There are two ______ on the table.', options: ['apple', 'apples', 'an apple', 'apple’s'], answer: 'apples' },
      { text: 'We ______ football every Sunday.', options: ['play', 'plays', 'playing', 'to play'], answer: 'play' },
      { text: 'This is ______ umbrella.', options: ['a', 'an', 'the a', 'some'], answer: 'an' },
    ],
  },
  {
    title: 'A2 Elementary',
    level: 'Elementary',
    result: 'Elementary',
    questions: [
      { text: 'I ______ to the cinema last night.', options: ['go', 'goes', 'went', 'gone'], answer: 'went' },
      { text: 'My brother is ______ than me.', options: ['tall', 'taller', 'tallest', 'more tall'], answer: 'taller' },
      { text: 'Look! It ______ outside.', options: ['rains', 'is raining', 'rained', 'rain'], answer: 'is raining' },
      { text: 'How ______ sugar do you want in your tea?', options: ['many', 'much', 'lot', 'few'], answer: 'much' },
      { text: 'Could you open the window, please?', options: ['Sure, no problem.', 'Yes, I could.', 'No, it is.', 'I open it yesterday.'], answer: 'Sure, no problem.' },
    ],
  },
  {
    title: 'B1 Pre-Intermediate',
    level: 'Pre-Intermediate',
    result: 'Pre-Intermediate',
    questions: [
      { text: 'I have lived in this city ______ 2015.', options: ['for', 'since', 'from', 'during'], answer: 'since' },
      { text: 'If it rains tomorrow, we ______ at home.', options: ['stay', 'will stay', 'would stay', 'stayed'], answer: 'will stay' },
      { text: 'She was cooking dinner when the phone ______.', options: ['rang', 'was ringing', 'rings', 'has rung'], answer: 'rang' },
      { text: 'You ______ smoke in the hospital. It is not allowed.', options: ["mustn't", "don't have to", "needn't", "wouldn't"], answer: "mustn't" },
      { text: 'This is the man ______ car was stolen.', options: ['who', 'which', 'whose', 'whom'], answer: 'whose' },
    ],
  },
  {
    title: 'B1+ Intermediate',
    level: 'Intermediate',
    result: 'Intermediate',
    questions: [
      { text: 'The bridge ______ in 1990.', options: ['built', 'was built', 'has built', 'is building'], answer: 'was built' },
      { text: 'I wish I ______ more free time.', options: ['have', 'had', 'will have', 'am having'], answer: 'had' },
      { text: 'By the time we arrived, the film ______.', options: ['already started', 'has already started', 'had already started', 'was already start'], answer: 'had already started' },
      { text: 'She suggested ______ a taxi.', options: ['take', 'to take', 'taking', 'took'], answer: 'taking' },
      { text: "I'm looking forward ______ you soon.", options: ['to see', 'to seeing', 'seeing', 'see'], answer: 'to seeing' },
    ],
  },
  {
    title: 'B2 IELTS Boshlang‘ich',
    level: "IELTS Boshlang'ich",
    result: 'IELTS Novice',
    questions: [
      { text: 'Had I known about the traffic, I ______ earlier.', options: ['would leave', 'would have left', 'had left', 'will have left'], answer: 'would have left' },
      { text: 'The number of students has risen ______ 20% over the last decade.', options: ['at', 'by', 'with', 'for'], answer: 'by' },
      { text: '______ the bad weather, the flight departed on time.', options: ['Although', 'Despite', 'Even though', 'However'], answer: 'Despite' },
      { text: 'The government should ______ measures to reduce air pollution.', options: ['make', 'do', 'take', 'put'], answer: 'take' },
      { text: 'Not only ______ late, but he also forgot the documents.', options: ['he arrived', 'did he arrive', 'he did arrive', 'arrived he'], answer: 'did he arrive' },
    ],
  },
  {
    title: 'C1 IELTS Standart',
    level: 'IELTS Standart',
    result: 'IELTS Standard',
    questions: [
      { text: 'The findings of the study ______ doubt on earlier theories.', options: ['cast', 'threw', 'put', 'made'], answer: 'cast' },
      { text: 'Rarely ______ such a remarkable performance.', options: ['I have seen', 'have I seen', 'I saw', 'did I saw'], answer: 'have I seen' },
      { text: 'The new policy had a ______ effect on unemployment, reducing it sharply.', options: ['negligible', 'profound', 'marginal', 'redundant'], answer: 'profound' },
      { text: 'It is high time the authorities ______ action on this issue.', options: ['take', 'took', 'will take', 'have taken'], answer: 'took' },
      { text: 'The evidence is ______; it does not prove anything conclusively.', options: ['compelling', 'inconclusive', 'irrefutable', 'substantial'], answer: 'inconclusive' },
    ],
  },
];
