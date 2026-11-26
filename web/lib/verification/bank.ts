import type { GateQuestion, ProfileGateBank } from './types'

/**
 * Owner-supplied read-verification questions, 4–5 per profile, per the
 * requirement. Each question's correct answer reflects what that profile
 * actually says (see lib/mock-data.ts); the 3 distractor options are
 * deliberately-wrong quiz choices I authored to make the question
 * selectable, not assertions about the person — nothing here fabricates a
 * fact about anyone (requirement: "never fabricate personal facts").
 *
 * Interpretation flagged in docs/OPEN_QUESTIONS.md: the requirement says
 * "owner-supplied questions and correct answers" without specifying whether
 * the reader picks from options or types free text. I kept the existing
 * product's multiple-choice pattern (choicemi-full.html's `quiz` field) —
 * the correct answer is the owner's; the distractors exist only to make a
 * selectable question, authored by the same profile owner in the intended
 * real product (this seed data stands in for that authoring step, which
 * belongs in profile-builder UI once real accounts exist).
 */

function bank(profileId: string, questions: [string, string, string[]][]): ProfileGateBank {
  return {
    profileId,
    questions: questions.map(([question, correctAnswer, distractors], i): GateQuestion => ({
      id: `${profileId}-q${i + 1}`,
      question,
      correctAnswer,
      options: shuffleDeterministic([correctAnswer, ...distractors], profileId + i),
    })),
  }
}

/** Stable, deterministic shuffle so option order doesn't change between requests for the same question. */
function shuffleDeterministic<T>(arr: T[], seed: string): T[] {
  const out = [...arr]
  let h = 0
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  for (let i = out.length - 1; i > 0; i--) {
    h = (h * 1103515245 + 12345) >>> 0
    const j = h % (i + 1)
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

const BANKS: Record<string, ProfileGateBank> = {
  '1': bank('1', [
    [
      "What does Maple_Dusk say they'd rather do than rush through five places?",
      'Travel slowly and do one place properly',
      ['Visit as many countries as possible', 'Stay home instead of travelling', 'Plan every detail in advance'],
    ],
    [
      'According to their profile, who does Maple_Dusk cook for?',
      'People they care about',
      ['Only themselves', 'Anyone who asks', "They don't cook"],
    ],
    [
      "What is Maple_Dusk's ideal first date?",
      'Morning coffee at a quiet café',
      ['A late-night bar', 'A big group dinner', 'A live music venue'],
    ],
    [
      'Is Maple_Dusk a smoker?',
      'No — non-smoker',
      ['Yes, regularly', 'Only socially', 'Trying to quit'],
    ],
    [
      'Does Maple_Dusk want children?',
      'No',
      ['Yes, definitely', 'Undecided', 'Wants a big family'],
    ],
  ]),
  '2': bank('2', [
    [
      "What is Cedar_Mist's profession?",
      'Architecture',
      ['Medicine', 'Law', 'Teaching'],
    ],
    [
      'Where does Cedar_Mist spend most weekends?',
      'The climbing gym or trying new coffee spots',
      ['At the gym lifting weights', 'Volunteering', 'Working overtime'],
    ],
    [
      "How does Cedar_Mist describe their communication style?",
      'Direct',
      ['Reserved', 'Avoids conflict', 'Passive'],
    ],
    [
      'Does Cedar_Mist drink alcohol?',
      'Occasionally',
      ['Never', 'Regularly', 'Only wine'],
    ],
    [
      "What's Cedar_Mist's ideal first date?",
      'Coffee or an outdoor walk, casual, in the afternoon',
      ['A formal dinner', 'A nightclub', 'A long road trip'],
    ],
  ]),
  '3': bank('3', [
    [
      'How does River_Ash describe opening up to new people?',
      "Takes time, but they're worth the wait",
      ['Very open immediately', 'Never opens up', 'Only with family'],
    ],
    [
      'Does River_Ash drink alcohol?',
      'No — non-drinker',
      ['Yes, socially', 'Yes, regularly', 'Only on weekends'],
    ],
    [
      'What does River_Ash consider a romantic evening?',
      'A quiet dinner with good conversation, no distractions',
      ['A big party', 'A loud concert', 'Watching TV together'],
    ],
    [
      'Does River_Ash already have children?',
      'Yes',
      ['No', 'Prefers not to say', 'Wants none'],
    ],
    [
      "What's one of River_Ash's hobbies mentioned in their profile?",
      'Running',
      ['Painting', 'Cooking classes', 'Rock climbing'],
    ],
  ]),
  '4': bank('4', [
    [
      "What is Storm_Pine's profession?",
      'Civil engineering',
      ['Architecture', 'Urban planning', 'Accounting'],
    ],
    [
      'What is Storm_Pine looking for?',
      'The last first date they ever need — something serious',
      ['Something casual', 'New friends only', 'Networking'],
    ],
    [
      'Does Storm_Pine want children in the future?',
      'Yes',
      ['No', 'Undecided', 'Already has children'],
    ],
    [
      "What's Storm_Pine's ideal first date setting?",
      'A restaurant or cultural venue in the evening',
      ['A quiet morning walk', 'An all-day hike', 'A video call'],
    ],
    [
      'How does Storm_Pine describe themselves?',
      'Warm, and a little intense about things they care about',
      ['Cold and distant', 'Extremely shy', 'Indifferent'],
    ],
  ]),
}

export function getGateBank(profileId: string): ProfileGateBank | undefined {
  return BANKS[profileId]
}
