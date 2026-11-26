import type { FeedbackQuestion, Question, QuestionDimension } from '@/types'

export const QUESTION_DIMENSIONS: { id: QuestionDimension; label: string }[] = [
  { id: 'personality', label: 'Personality' },
  { id: 'values', label: 'Values' },
  { id: 'lifestyle', label: 'Lifestyle' },
  { id: 'relationship', label: 'Relationship' },
  { id: 'future', label: 'Future' },
]

export const QUESTIONS: Record<QuestionDimension, Question[]> = {
  personality: [
    { id: 'p1', q: 'Are you more of an introvert or extrovert?', opts: ['Introvert — I recharge alone', 'Extrovert — I come alive around people', 'Ambivert — somewhere in between', 'Depends entirely on context'] },
    { id: 'p2', q: 'How do you typically calm down after a stressful day?', opts: ['Time alone — quiet, music, or a walk', 'Talking it out with someone I trust', 'Exercise or physical activity', 'Cooking, creating, something with my hands'] },
    { id: 'p3', q: 'When plans change last minute, how do you handle it?', opts: ['Pivot quickly — I find something enjoyable', 'Feel a bit annoyed but adapt', 'Use it as time for myself', 'Try to keep the original plan somehow'] },
    { id: 'p4', q: 'How would the people who know you best describe you?', opts: ['Reliable and dependable', 'Adventurous and spontaneous', 'Warm and empathetic', 'Ambitious and driven'] },
    { id: 'p5', q: 'How do you feel about silence when with someone?', opts: ['Comfortable — I find it peaceful', 'A little awkward at first', 'Fine once I know someone well', 'I tend to fill it naturally'] },
    { id: 'p6', q: 'Are you a glass-half-empty or glass-half-full person?', opts: ['Mostly half-full — I tend toward optimism', "Mostly half-empty — I'm more of a realist", 'It shifts depending on the situation', 'I try not to label myself either way'] },
  ],
  values: [
    { id: 'v1', q: 'How important is faith or religion in your daily life?', opts: ['Very important — it shapes how I live', "Somewhat important — I believe but don't practise much", 'Spiritually curious but not attached to a religion', 'Not important to me personally'] },
    { id: 'v2', q: 'Do you believe in hard work, luck, or both?', opts: ['Mostly hard work — you create your own path', 'A combination — effort plus opportunity', 'Largely luck — so much is out of our hands', 'I believe in timing above all'] },
    { id: 'v3', q: 'A cashier gives you too much change — what do you do?', opts: ['Give it back immediately without hesitation', 'Give it back, though I notice I’m tempted', 'Depends on the amount', 'Keep it — mistakes happen'] },
    { id: 'v4', q: 'How do you approach saving versus spending money?', opts: ['Save first, spend what is left', 'Spend on experiences, save what I can', 'Live in the moment — money is to be used', 'I have a structured financial plan'] },
    { id: 'v5', q: 'Do you believe in soulmates?', opts: ['Yes — I believe in a deep, fated connection', 'Maybe — certain people are meant to meet', 'No — love is a choice and a practice', 'I used to, but I no longer think so'] },
    { id: 'v6', q: 'How do you feel about social media in your life?', opts: ['I use it actively and enjoy sharing', 'I use it to connect but keep things private', 'I use it sparingly — it drains me', 'I barely use it anymore'] },
  ],
  lifestyle: [
    { id: 'l1', q: 'Are you more of a morning person or a night owl?', opts: ['Definitely a morning person', 'Definitely a night owl', 'Somewhere in the middle', 'It depends on my week'] },
    { id: 'l2', q: 'What does a perfect vacation look like?', opts: ['Cultural exploration — cities, museums, history', 'Nature and adventure — hiking, outdoors', 'Complete relaxation — beach, slow pace', 'A mix — discover by day, rest by evening'] },
    { id: 'l3', q: 'How health-conscious are you in daily life?', opts: ['Very — I eat mindfully and exercise regularly', "Fairly — I try but I'm not strict", 'Casually — some effort without obsessing', 'Not particularly a priority right now'] },
    { id: 'l4', q: 'Do you prefer home-cooked meals or eating out?', opts: ['Home-cooked — I love cooking and the comfort', 'Eating out — I enjoy the experience and variety', 'A healthy balance of both', 'Depends on my mood and energy'] },
    { id: 'l5', q: 'Do you prefer city life or a quieter environment?', opts: ['City life — energy, culture, convenience', 'Quiet surroundings — peace and space matter', 'Suburban — close enough to both', 'I change my mind on this often'] },
    { id: 'l6', q: 'Do you love travelling or staying home?', opts: ['Travel is one of my greatest passions', 'I enjoy travel but home is where I recharge', "I travel occasionally but don't crave it", 'I prefer the comfort of staying home'] },
  ],
  relationship: [
    { id: 'r1', q: 'How do you prefer to handle conflict in a relationship?', opts: ['Talk it through calmly as soon as possible', 'Take space first, then come back to it', 'I tend to avoid conflict — I dislike confrontation', 'Depends on the issue and how I am feeling'] },
    { id: 'r2', q: 'What do you consider real quality time with a partner?', opts: ['Being present together, even in silence', 'Deep conversations that go somewhere meaningful', 'Shared activities — cooking, exploring, creating', "Anything we both enjoy, as long as we're together"] },
    { id: 'r3', q: 'If you had a really bad day, what would you need?', opts: ['Space and quiet — time to process alone', 'To talk it through and feel heard', 'Physical comfort — closeness without talking', 'Distraction — something light to shift my mood'] },
    { id: 'r4', q: 'How much independence do you need in a relationship?', opts: ['A lot — my own space and life outside us matters', 'A fair amount — balance between togetherness and freedom', 'Not much — I love being close and connected', 'It varies with where I am in life'] },
    { id: 'r5', q: 'How do you show affection most naturally?', opts: ['Words — I express how I feel directly', 'Actions — I do things to show I care', 'Touch — physical presence and closeness', 'Thoughtfulness — I notice and remember details'] },
    { id: 'r6', q: 'How do you feel about emotional vulnerability?', opts: ['I open up fairly easily once I feel safe', 'I take time — I need trust before being vulnerable', "I find it very difficult — it doesn't come naturally", 'I value it deeply but have had to work hard at it'] },
  ],
  future: [
    { id: 'f1', q: 'How many children do you want in your future, if any?', opts: ['None — I do not want children', 'One or two — a small family', 'Three or more — I want a larger family', "I'm open and genuinely undecided right now"] },
    { id: 'f2', q: 'When do you picture getting married, if at all?', opts: ['Within the next few years', 'When I find the right person — no timeline', 'Not for a long while — focused elsewhere', 'Marriage is not something I plan to do'] },
    { id: 'f3', q: 'How important is it that family accepts your partner?', opts: ['Essential — family harmony matters deeply', "Important, though I wouldn't let it stop a good relationship", 'I care but my partner comes first', 'My family has little influence over who I choose'] },
    { id: 'f4', q: 'Where do you see yourself living in 5–10 years?', opts: ['In Finland — I am rooted here', 'Elsewhere in Europe', 'Open to anywhere — flexibility matters', "I genuinely haven't decided yet"] },
    { id: 'f5', q: 'Is being friends with your partner important to you?', opts: ['Yes — that friendship foundation matters deeply', 'Somewhat — attraction matters as much', "I hadn't thought about it that way", 'Not particularly — I keep those two things separate'] },
    { id: 'f6', q: 'How important is financial compatibility long-term?', opts: ['Very important — different money values cause real problems', 'Important — we should be broadly aligned', 'Moderately — as long as we communicate', 'Not a major concern for me personally'] },
  ],
}

export const FEEDBACK_QUESTIONS: FeedbackQuestion[] = [
  { q: 'Did they show up?', opts: ['Yes, on time', 'Yes, a little late', 'No — they cancelled', 'No-show'], key: 'showed' },
  { q: 'Did they match their profile?', opts: ['Yes, accurately', 'Mostly yes', 'Somewhat', 'Not really'], key: 'matched' },
  { q: 'Was the person respectful and kind?', opts: ['Excellent', 'Good', 'Neutral', 'Made me uncomfortable'], key: 'respect' },
  { q: 'Did you feel safe throughout?', opts: ['Yes, completely', 'Mostly yes', 'Not entirely', 'No'], key: 'safe' },
  { q: 'Would you like a re-date?', opts: ['Yes, definitely', 'Maybe', 'Probably not', 'No'], key: 'redate' },
  { q: 'Was the venue a good choice?', opts: ['Perfect', 'Good', 'Okay', 'Not great'], key: 'venue' },
]
