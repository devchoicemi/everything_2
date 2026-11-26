'use client'

import { Suspense, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Ban,
  Cake,
  Check,
  Clock,
  Coffee,
  Gem,
  Leaf,
  MapPin,
  ShieldAlert,
  Sparkles,
  Sprout,
  UserRound,
  X,
  type LucideIcon,
} from 'lucide-react'
import { StepShell } from '@/components/onboarding/StepShell'
import { CompatibilityBuilder } from '@/components/onboarding/CompatibilityBuilder'
import { PoolQuestionPicker } from '@/components/onboarding/PoolQuestionPicker'
import { StoryGuide } from '@/components/onboarding/StoryGuide'
import { LayoutThumb } from '@/components/profile/LayoutThumb'
import { ProfileCVView } from '@/components/profile/ProfileCVView'
import { Button } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { Reveal } from '@/components/ui/Reveal'
import { cn, distanceLabel } from '@/lib/utils'
import { draftProgress, draftToPayload, isVariableComplete } from '@/lib/compat/onboardingDraft'
import { VARIABLE_CATALOG } from '@/lib/compat/config'
import { cvFromMember } from '@/lib/profile/cv'
import { PROFILE_LAYOUTS, normalizeLayout } from '@/lib/profile/layouts'
import { assessStory } from '@/lib/profile/quality'
import { validateGateQuestions } from '@/lib/verification/validate'
import { aiService, gateQuestionsService, profileVariablesService } from '@/services/api'
import { profileApi } from '@/services/profile'
import { MIN_PICKS, profileSnapshot, useStore } from '@/store'

const TOTAL_STEPS = 7

const INTENTS: { t: string; d: string; i: LucideIcon }[] = [
  { t: 'Serious relationship', d: 'Looking for something real and lasting', i: Gem },
  { t: 'Marriage-minded', d: 'Actively looking toward a future together', i: Leaf },
  { t: 'Long-term dating', d: 'Serious but no rush on labels', i: Sprout },
  { t: 'Casual dating', d: 'Open to connection, keeping things light', i: Coffee },
]

const LIFESTYLE_GROUPS = [
  ['Non-smoker', 'Smoker', 'Non-drinker', 'Social drinker'],
  ['Morning person', 'Night owl', 'Introvert', 'Extrovert', 'Ambivert'],
  ['Active / sporty', 'Homebody', 'Traveller', 'Foodie'],
  ['No children', 'Has children', 'Wants children'],
]

const PROFESSION_OPTIONS = [
  'Business / management',
  'Technology / engineering',
  'Healthcare / medicine',
  'Education / research',
  'Creative / arts / design',
  'Law / finance / consulting',
  'Trades / skilled work',
  'Student',
  'Self-employed / entrepreneur',
  'Prefer not to say',
]

const DATE_TYPES = ['Coffee', 'Restaurant', 'Walk outdoors', 'Art / culture', 'Live music', 'Games / activity', 'Dessert spot']
const ATMOSPHERE = ['Quiet', 'Casual', 'Cosy', 'Lively', 'Romantic']
// 12:00pm-7:00pm venue booking window: no morning option (see lib/booking.ts)
const TIMES = [
  'Early afternoon, 12pm to 2pm',
  'Afternoon, 2pm to 5pm',
  'Early evening, 5pm to 7pm',
  'Flexible, any time within our hours',
]
// Every member is ID-verified before they can use ChoiceMi, so there is no "verified only" choice.
const SAFETY = [
  { t: 'Public place only', d: 'First date must be in a public venue' },
  { t: 'Daytime only for first dates', d: 'I prefer to meet during daylight hours' },
]
const DEALBREAKERS = ['Block smokers', 'Block heavy drinkers', 'No previous no-shows']

function OnboardingInner() {
  const router = useRouter()
  const params = useSearchParams()
  const step = Math.min(TOTAL_STEPS, Math.max(1, Number(params.get('step') ?? '1')))
  const ob = useStore((s) => s.onboarding)
  const patch = useStore((s) => s.patchOnboarding)
  const toggle = useStore((s) => s.toggleOnboardingList)
  const aiDraft = useStore((s) => s.aiDraft)
  const patchAIDraft = useStore((s) => s.patchAIDraft)
  const compatDraft = useStore((s) => s.compatDraft)
  const gateQuestions = useStore((s) => s.gateQuestions)
  const user = useStore((s) => s.user)
  const toast = useStore((s) => s.toast)

  const [savingStep, setSavingStep] = useState(false)

  /** Saves the profile to the member's account in the background, so a sign-out never loses it. */
  function saveProgress() {
    void profileApi.save(profileSnapshot(useStore.getState())).catch(() => undefined)
  }

  const goTo = (n: number) => {
    saveProgress()
    router.push(`/onboarding?step=${n}`)
  }

  async function finish() {
    setSavingStep(true)
    try {
      await profileApi.save(profileSnapshot(useStore.getState()), true)
      router.push('/ready')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not save your profile. Please try again.', 'danger')
      setSavingStep(false)
    }
  }

  async function generateDraft() {
    if (!assessStory({ prompts: aiDraft.prompts ?? {}, extra: aiDraft.extra ?? '' }).ok) return toast('Go back and finish the questions about you first.', 'danger')
    patchAIDraft({ status: 'generating', error: null })
    try {
      const draft = await aiService.generateDraft(aiDraft.rawText, aiDraft.tags)
      patchAIDraft({
        shortBio: draft.shortBio,
        detailedProfile: draft.detailedProfile,
        tags: draft.suggestedTags,
        status: 'ready',
        approved: false,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not generate a draft. Please try again.'
      patchAIDraft({ status: 'error', error: message })
    }
  }

  async function continueFromCompatibility() {
    const incomplete = VARIABLE_CATALOG.filter((v) => !isVariableComplete(v, compatDraft[v.field]))
    if (incomplete.length > 0) {
      toast(`Finish rating: ${incomplete[0].label}`, 'danger')
      return
    }
    setSavingStep(true)
    try {
      await profileVariablesService.save(draftToPayload(compatDraft))
      goTo(4)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not save your compatibility answers.'
      toast(message, 'danger')
    } finally {
      setSavingStep(false)
    }
  }

  async function continueFromGateQuestions() {
    const payload = gateQuestions.map((q) => ({ question: q.question, correctAnswer: q.correctAnswer, distractors: q.distractors.filter(Boolean) }))
    const errors = validateGateQuestions(payload)
    if (errors.length) {
      toast(errors[0], 'danger')
      return
    }
    setSavingStep(true)
    try {
      await gateQuestionsService.save(payload)
      goTo(5)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not save your read-check questions.'
      toast(message, 'danger')
    } finally {
      setSavingStep(false)
    }
  }

  /* ------------------------------ step 1: identity ------------------------------ */
  if (step === 1) {
    const canContinue = Boolean(ob.gender) && ob.interestedIn.length > 0 && ob.city.trim().length > 0 && Boolean(ob.intent) && ob.consentSensitive
    return (
      <StepShell step={1} total={TOTAL_STEPS} label="Identity" title="Your profile" back="/verify">
        <Reveal>
          <h2 className="font-serif-i mb-1.5 text-[26px] text-warm-900">
            Who are <span className="text-brand-700">you?</span>
          </h2>
          <p className="mb-5 text-[13px] leading-relaxed text-warm-500">
            Your real name is never shown. A unique anonymous username will be assigned by the system.
          </p>
        </Reveal>

        <label className="field-label">I am a</label>
        <div className="mb-4.5 flex gap-2">
          {[
            ['man', 'Man'],
            ['woman', 'Woman'],
            ['nb', 'Non-binary'],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => patch({ gender: id })}
              className={cn('gender-btn', ob.gender === id && 'on')}
            >
              <UserRound size={20} className="mb-0.5 block" />
              {label}
            </button>
          ))}
        </div>

        <label className="field-label">Interested in</label>
        <div className="mb-4.5 flex gap-2">
          {['Men', 'Women', 'Everyone'].map((v) => (
            <Chip key={v} active={ob.interestedIn.includes(v)} onClick={() => toggle('interestedIn', v)}>
              {v}
            </Chip>
          ))}
        </div>

        <div className="mb-4">
          <label className="field-label">City</label>
          <input
            className="input"
            placeholder="e.g. Helsinki"
            value={ob.city}
            onChange={(e) => patch({ city: e.target.value })}
          />
        </div>

        <label className="field-label">What are you here for?</label>
        <div className="mb-1">
          {INTENTS.map((it) => (
            <button
              key={it.t}
              type="button"
              onClick={() => patch({ intent: it.t })}
              className={cn('ob-opt mb-2 w-full text-left', ob.intent === it.t && 'on')}
            >
              <span className="ob-radio">
                <span className="ob-radio-dot" />
              </span>
              <span className="flex-1">
                <span className="ob-opt-title block">{it.t}</span>
                <span className="ob-opt-desc block">{it.d}</span>
              </span>
              <it.i size={22} className="text-brand-700" />
            </button>
          ))}
        </div>

        <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-2xl border border-[var(--bdr)] bg-[var(--card)] p-3.5 text-[12.5px] leading-snug text-warm-600">
          <input
            type="checkbox"
            checked={ob.consentSensitive}
            onChange={(e) => patch({ consentSensitive: e.target.checked })}
            className="mt-0.5 h-[18px] w-[18px] flex-shrink-0 accent-brand-700"
          />
          <span>
            I agree that ChoiceMi may use the sensitive details I give here, such as who I am interested in and how important faith is
            to me, to match me with other members. I can withdraw this at any time. See the{' '}
            <Link href="/privacy" target="_blank" className="font-semibold text-brand-700 underline underline-offset-2">
              Privacy Policy
            </Link>
            .
          </span>
        </label>

        <Button className="mt-4" onClick={() => goTo(2)} disabled={!canContinue}>
          Continue →
        </Button>
        {!canContinue && (
          <p className="mt-2 text-center text-[11.5px] text-warm-400">
            {!ob.gender || ob.interestedIn.length === 0 || !ob.city.trim() || !ob.intent
              ? 'Answer each question above to continue.'
              : 'Tick the box above to continue.'}
          </p>
        )}
      </StepShell>
    )
  }

  /* ------------------------------ step 2: your words ------------------------------ */
  if (step === 2) {
    const hasHeadline = ob.headline.trim().length > 0
    const story = assessStory({ prompts: aiDraft.prompts ?? {}, extra: aiDraft.extra ?? '' })
    const canContinue = hasHeadline && story.ok

    return (
      <StepShell step={2} total={TOTAL_STEPS} label="Your story" title="Your profile" back="/onboarding?step=1">
        <Reveal>
          <h2 className="font-serif-i mb-1.5 text-[26px] text-warm-900">
            Your <span className="text-brand-700">words</span>
          </h2>
          <p className="mb-5 text-[13px] leading-relaxed text-warm-500">
            No photos here, so your words are how people get to know you. Answer a few short questions in your own words. At the very
            end we bring everything together into a profile that reads like a CV. Nothing is invented; it only organises what you write.
          </p>
        </Reveal>

        <div className="mb-5">
          <label className="field-label">
            Headline{' '}
            <span className="text-[11px] font-normal normal-case text-warm-300">one line that sounds like you</span>
          </label>
          <input
            className="input"
            maxLength={80}
            value={ob.headline}
            onChange={(e) => patch({ headline: e.target.value })}
            placeholder="e.g. Slow mornings and honest conversations"
          />
          <div className="char-count">{ob.headline.length} / 80</div>
        </div>

        <StoryGuide />

        <label className="field-label mt-5">Lifestyle tags</label>
        <div className="mb-4.5 space-y-2">
          {LIFESTYLE_GROUPS.map((g, gi) => (
            <div key={gi} className="flex flex-wrap gap-1.5">
              {g.map((tag) => (
                <Chip key={tag} size="sm" active={ob.lifestyle.includes(tag)} onClick={() => toggle('lifestyle', tag)}>
                  {tag}
                </Chip>
              ))}
            </div>
          ))}
        </div>

        <label className="field-label">Work / profession type</label>
        <select className="input mb-4.5" value={ob.profession} onChange={(e) => patch({ profession: e.target.value })}>
          <option value="">What best describes your work?</option>
          {PROFESSION_OPTIONS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>

        <Button onClick={() => goTo(3)} disabled={!canContinue}>
          Continue →
        </Button>
        {!canContinue && (
          <p className="mt-2 text-center text-[11.5px] text-warm-400">{!hasHeadline ? 'Add a headline to continue.' : story.message}</p>
        )}
      </StepShell>
    )
  }

  /* ------------------------------ step 3: compatibility ------------------------------ */
  if (step === 3) {
    const progress = draftProgress(compatDraft)
    return (
      <StepShell step={3} total={TOTAL_STEPS} label="Compatibility" title="Compatibility" back="/onboarding?step=2">
        <Reveal>
          <h2 className="font-serif-i mb-1.5 text-[24px] text-warm-900">
            What makes <span className="text-brand-700">you, you?</span>
          </h2>
          <p className="mb-3.5 text-[13px] leading-relaxed text-warm-500">
            This is what your match score is actually computed from: your own value for each trait, plus how much you would want a
            partner to have each possible value. Mark at most two per group as a dealbreaker to count it double.
          </p>
        </Reveal>
        <CompatibilityBuilder />
        <Button
          className="mt-3.5"
          disabled={progress.complete < progress.total || savingStep}
          onClick={continueFromCompatibility}
        >
          {savingStep ? 'Saving…' : 'Continue →'}
        </Button>
      </StepShell>
    )
  }

  /* ------------------------------ step 4: read-check from the pool ------------------------------ */
  if (step === 4)
    return (
      <StepShell step={4} total={TOTAL_STEPS} label="Read-check" title="Verification questions" back="/onboarding?step=3">
        <Reveal>
          <h2 className="font-serif-i mb-1.5 text-[24px] text-warm-900">
            Prove someone <span className="text-brand-700">actually read you</span>
          </h2>
          <p className="mb-3.5 text-[13px] leading-relaxed text-warm-500">
            Choose {MIN_PICKS} to 5 questions from our list and pick the answer that is true for you. Before anyone can propose a date
            with you, they will see one of them at random, with your answer mixed in among the others, and must spot it.
          </p>
        </Reveal>
        <PoolQuestionPicker />
        <Button className="mt-4" disabled={savingStep || gateQuestions.length < MIN_PICKS} onClick={continueFromGateQuestions}>
          {savingStep ? 'Saving…' : 'Continue →'}
        </Button>
        {gateQuestions.length < MIN_PICKS && (
          <p className="mt-2 text-center text-[11.5px] text-warm-400">
            Choose {MIN_PICKS - gateQuestions.length} more question{MIN_PICKS - gateQuestions.length === 1 ? '' : 's'} to continue.
          </p>
        )}
      </StepShell>
    )

  /* ------------------------------ step 5: date preferences ------------------------------ */
  if (step === 5)
    return (
      <StepShell step={5} total={TOTAL_STEPS} label="First date setup" title="Date preferences" back="/onboarding?step=4">
        <Reveal>
          <h2 className="font-serif-i mb-1.5 text-[26px] text-warm-900">
            How do you <span className="text-brand-700">like to meet?</span>
          </h2>
          <p className="mb-5 text-[13px] leading-relaxed text-warm-500">
            This powers blind date coordination. All ChoiceMi dates are booked between 12:00pm and
            7:00pm at partner venues.
          </p>
        </Reveal>

        <PrefCard icon={Coffee} title="Preferred date type">
          <div className="flex flex-wrap gap-1.5">
            {DATE_TYPES.map((t) => (
              <Chip key={t} size="sm" active={ob.dateTypes.includes(t)} onClick={() => toggle('dateTypes', t)}>
                {t}
              </Chip>
            ))}
          </div>
        </PrefCard>

        <PrefCard icon={Leaf} title="Preferred atmosphere">
          <div className="flex flex-wrap gap-1.5">
            {ATMOSPHERE.map((t) => (
              <Chip key={t} size="sm" active={ob.atmosphere.includes(t)} onClick={() => toggle('atmosphere', t)}>
                {t}
              </Chip>
            ))}
          </div>
        </PrefCard>

        <PrefCard icon={Clock} title="Best time for a first date">
          {TIMES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => patch({ bestTime: t })}
              className={cn('ob-opt mb-2 w-full text-left', ob.bestTime === t && 'on')}
            >
              <span className="ob-radio">
                <span className="ob-radio-dot" />
              </span>
              <span className="ob-opt-title">{t}</span>
            </button>
          ))}
        </PrefCard>

        <PrefCard icon={ShieldAlert} title="Safety preference">
          {SAFETY.map((s) => (
            <button
              key={s.t}
              type="button"
              onClick={() => patch({ safety: s.t })}
              className={cn('ob-opt mb-2 w-full text-left', ob.safety === s.t && 'on')}
            >
              <span className="ob-radio">
                <span className="ob-radio-dot" />
              </span>
              <span className="flex-1">
                <span className="ob-opt-title block">{s.t}</span>
                <span className="ob-opt-desc block">{s.d}</span>
              </span>
            </button>
          ))}
        </PrefCard>

        <Button onClick={() => goTo(6)}>Continue →</Button>
      </StepShell>
    )

  /* ------------------------------ step 6: filters ------------------------------ */
  if (step === 6)
    return (
      <StepShell step={6} total={TOTAL_STEPS} label="Match filters" title="Your filters" back="/onboarding?step=5">
        <Reveal>
          <h2 className="font-serif-i mb-1.5 text-[26px] text-warm-900">
            Who do you <span className="text-brand-700">want to meet?</span>
          </h2>
          <p className="mb-5 text-[13px] leading-relaxed text-warm-500">
            These filters shape who appears in your discovery feed. Change them anytime.
          </p>
        </Reveal>

        <PrefCard icon={Cake} title="Age range">
          <div className="flex gap-2.5">
            <div className="flex-1">
              <label className="field-label !mb-1.5">From</label>
              <select
                className="input !py-2.5"
                value={ob.ageFrom}
                onChange={(e) => patch({ ageFrom: Number(e.target.value) })}
              >
                {[18, 20, 22, 24, 26, 28, 30].map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="field-label !mb-1.5">To</label>
              <select
                className="input !py-2.5"
                value={ob.ageTo}
                onChange={(e) => patch({ ageTo: Number(e.target.value) })}
              >
                {[25, 28, 32, 35, 40, 45, 50].map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </div>
          </div>
        </PrefCard>

        <PrefCard icon={MapPin} title="Maximum distance">
          <input
            type="range"
            min={1}
            max={5}
            value={ob.distanceStep}
            onChange={(e) => patch({ distanceStep: Number(e.target.value) })}
            className="w-full accent-brand-700"
          />
          <div className="mt-2 text-center text-[14px] font-semibold text-brand-700">
            {distanceLabel(ob.distanceStep)}
          </div>
        </PrefCard>

        <PrefCard icon={Ban} title="Hard dealbreakers">
          <div className="flex flex-wrap gap-1.5">
            {DEALBREAKERS.map((d) => (
              <Chip key={d} size="sm" active={ob.dealbreakers.includes(d)} onClick={() => toggle('dealbreakers', d)}>
                {d}
              </Chip>
            ))}
          </div>
        </PrefCard>

        <Button onClick={() => goTo(7)}>Continue →</Button>
      </StepShell>
    )

  /* ------------------------------ step 7: build the profile ------------------------------ */
  return (
    <BuildProfileStep
      onGenerate={generateDraft}
      onFinish={finish}
      saving={savingStep}
      username={user.username}
    />
  )
}

function BuildProfileStep({
  onGenerate,
  onFinish,
  saving,
  username,
}: {
  onGenerate: () => void
  onFinish: () => void
  saving: boolean
  username: string
}) {
  const ob = useStore((s) => s.onboarding)
  const aiDraft = useStore((s) => s.aiDraft)
  const patchAIDraft = useStore((s) => s.patchAIDraft)
  const compatDraft = useStore((s) => s.compatDraft)
  const layout = normalizeLayout(aiDraft.layout)

  const cv = useMemo(
    () => cvFromMember({ username, onboarding: ob, compat: compatDraft, ai: aiDraft }),
    [username, ob, compatDraft, aiDraft],
  )

  return (
    <StepShell step={TOTAL_STEPS} total={TOTAL_STEPS} label="Your profile" title="Build your profile" back="/onboarding?step=6">
      <Reveal>
        <h2 className="font-serif-i mb-1.5 text-[26px] text-warm-900">
          Here is <span className="text-brand-700">your profile</span>
        </h2>
        <p className="mb-5 text-[13px] leading-relaxed text-warm-500">
          Everything you told us is organised into one profile that reads like a CV. Let our AI tidy your story, pick a design you
          like, and check the preview. Nothing is invented: it only reorganises your own answers.
        </p>
      </Reveal>

      <Button type="button" variant="secondary" onClick={onGenerate} disabled={aiDraft.status === 'generating'}>
        <Sparkles size={15} />
        {aiDraft.status === 'generating' ? 'Generating…' : aiDraft.status === 'ready' ? 'Generate again →' : 'Generate my profile with AI →'}
      </Button>
      <p className="mt-2 text-[11.5px] text-warm-400">Optional. Without it, your profile uses your own words exactly as you wrote them.</p>
      {aiDraft.status === 'error' && <p className="mt-2 text-[12.5px] text-danger">{aiDraft.error}</p>}

      {aiDraft.status === 'ready' && (
        <div className="mt-5 space-y-4 rounded-2xl border border-brand-200 bg-brand-50/50 p-4">
          <p className="text-[12px] font-semibold uppercase tracking-wide text-brand-700">Review your AI-assisted draft</p>

          <div>
            <label className="field-label">Profile summary (short)</label>
            <textarea
              className="input"
              rows={3}
              value={aiDraft.shortBio}
              onChange={(e) => patchAIDraft({ shortBio: e.target.value, approved: false })}
            />
          </div>

          <div>
            <label className="field-label">My story (detailed)</label>
            <textarea
              className="input"
              rows={6}
              value={aiDraft.detailedProfile}
              onChange={(e) => patchAIDraft({ detailedProfile: e.target.value, approved: false })}
            />
          </div>

          {aiDraft.tags.length > 0 && (
            <div>
              <label className="field-label">Interests found in your words</label>
              <div className="flex flex-wrap gap-1.5">
                {aiDraft.tags.map((t) => (
                  <Chip key={t} size="sm" active onClick={() => patchAIDraft({ tags: aiDraft.tags.filter((x) => x !== t), approved: false })}>
                    {t} <X size={12} />
                  </Chip>
                ))}
              </div>
            </div>
          )}

          <label className="flex items-start gap-2.5 rounded-xl border border-[var(--bdr)] bg-[var(--card)] p-3">
            <input
              type="checkbox"
              checked={aiDraft.approved}
              onChange={(e) => patchAIDraft({ approved: e.target.checked })}
              className="mt-0.5 h-4 w-4 accent-brand-700"
            />
            <span className="text-[13px] text-warm-700">I&apos;ve reviewed this and it&apos;s accurate. Use it as my profile text.</span>
          </label>
        </div>
      )}

      <label className="field-label mt-6 block">Choose a profile design</label>
      <div className="mb-4 grid grid-cols-2 gap-2.5">
        {PROFILE_LAYOUTS.map((l) => (
          <button
            key={l.id}
            type="button"
            onClick={() => patchAIDraft({ layout: l.id })}
            aria-pressed={layout === l.id}
            className={cn(
              'rounded-2xl border-[1.5px] p-2.5 text-left transition-colors',
              layout === l.id ? 'border-brand-600 bg-brand-50' : 'border-[var(--bdr)] bg-[var(--card)]',
            )}
          >
            <LayoutThumb id={l.id} />
            <div className="mt-2 flex items-center justify-between">
              <span className="text-[13px] font-semibold text-warm-800">{l.label}</span>
              {layout === l.id && <Check size={14} className="text-brand-700" />}
            </div>
            <p className="mt-0.5 text-[11px] leading-snug text-warm-500">{l.desc}</p>
          </button>
        ))}
      </div>

      <label className="field-label block">Preview</label>
      <div className="mb-5">
        <ProfileCVView cv={cv} layout={layout} compact />
      </div>

      <Button onClick={onFinish} disabled={saving}>
        {saving ? 'Saving…' : 'Finish setup →'}
      </Button>
    </StepShell>
  )
}

function PrefCard({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="surface-card mb-3 p-4">
      <div className="mb-2.5 flex items-center gap-1.5 text-[13px] font-semibold text-warm-700">
        <Icon size={16} />
        {title}
      </div>
      {children}
    </div>
  )
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={null}>
      <OnboardingInner />
    </Suspense>
  )
}
