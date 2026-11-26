// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { STORY_PROMPTS, assessStory, checkText, composeStory } from '@/lib/profile/quality'

const GOOD = 'A slow morning with coffee, a long walk by the sea, then football with friends.'

describe('checkText: filler is caught, real writing passes', () => {
  it.each([
    ['123445566', 'mostly_numbers'],
    ['1234 5678 9012 3456 7890', 'mostly_numbers'],
    ['!!!! ???? .... ,,,, ----', 'mostly_numbers'],
    ['hello hello hello hello hello hello hello hello hello', 'repeated'],
    ['I like I like I like I like I like I like I like I like', 'repeated'],
    ['asdfgh jklqwe zxcvbn qwerty uiopas dfghjk', 'gibberish'],
    ['hjkl hjkl wxyz brrr psst grrr pppp tttt', 'gibberish'],
    ['aaaaaaa bbbbbbb ccccccc ddddddd eeeeeee', 'gibberish'],
    ['', 'empty'],
  ])('rejects %j', (text, problem) => {
    const r = checkText(text)
    expect(r.ok).toBe(false)
    expect(r.problem).toBe(problem)
  })

  it('asks for a bit more when it is real but short', () => {
    const r = checkText('I love hiking and good coffee')
    expect(r.ok).toBe(false)
    expect(r.problem).toBe('too_short')
    expect(r.message).toMatch(/at least 8 words/)
  })

  it('accepts real sentences', () => {
    expect(checkText(GOOD)).toMatchObject({ ok: true })
    expect(checkText('Ihmiset sanovat että olen luotettava, hauska ja vähän itsepäinen, mutta aina valmis seikkailuun.').ok).toBe(true)
    expect(checkText('Je suis passionné de cuisine, de randonnée et de longues conversations autour d’un café.').ok).toBe(true)
  })

  it('accepts a real answer that mentions numbers and names', () => {
    expect(checkText('I am 29, I speak 4 languages (English, Yoruba, Finnish, Spanish) and I run 5 km every morning.').ok).toBe(true)
  })

  it('does not count numbers as words, so padding with digits does not help', () => {
    const r = checkText('I like coffee 1 2 3 4 5 6 7 8 9 10 11 12')
    expect(r.ok).toBe(false)
  })

  it('caps length', () => {
    const r = checkText(Array(160).fill('walking').join(' ') + ' by the sea with friends')
    expect(r.ok).toBe(false)
  })
})

describe('assessStory', () => {
  const answer = (n: number) => Object.fromEntries(STORY_PROMPTS.slice(0, n).map((p) => [p.id, p.example]))

  it('needs three good answers', () => {
    expect(assessStory({ prompts: answer(2), extra: '' })).toMatchObject({ ok: false, answered: 2 })
    expect(assessStory({ prompts: answer(2), extra: '' }).message).toMatch(/1 more question/)
    expect(assessStory({ prompts: answer(3), extra: '' })).toMatchObject({ ok: true, answered: 3 })
  })

  it('the example answers shown on screen pass their own check', () => {
    for (const p of STORY_PROMPTS) expect(checkText(p.example).ok, p.id).toBe(true)
  })

  it('one filler answer blocks the whole thing, and says which', () => {
    const r = assessStory({ prompts: { ...answer(3), weekend: '123445566' }, extra: '' })
    expect(r.ok).toBe(false)
    expect(r.checks.weekend.problem).toBe('mostly_numbers')
  })

  it('filler in the optional extra box also blocks', () => {
    expect(assessStory({ prompts: answer(3), extra: 'aaaaa bbbbb ccccc ddddd eeeee' }).ok).toBe(false)
  })

  it('still accepts an older single free text if it is long and real', () => {
    const long = STORY_PROMPTS.map((p) => p.example).join(' ') + ' ' + GOOD
    expect(assessStory({ prompts: {}, extra: long }).ok).toBe(true)
    expect(assessStory({ prompts: {}, extra: GOOD }).ok).toBe(false)
    expect(assessStory({ prompts: {}, extra: '1234567890 '.repeat(20) }).ok).toBe(false)
  })

  it('composes the story in prompt order, with the extra text last', () => {
    const text = composeStory({ prompts: { looking: 'B text', weekend: 'A text' }, extra: 'Extra text' })
    expect(text).toBe('A text\n\nB text\n\nExtra text')
  })
})
