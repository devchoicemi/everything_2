'use client'

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, Check, ChevronRight, Lock, LogOut, Pencil, ShieldAlert, ShieldCheck, SlidersHorizontal, Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { LayoutThumb } from '@/components/profile/LayoutThumb'
import { ProfileCVView } from '@/components/profile/ProfileCVView'
import { Button } from '@/components/ui/Button'
import { BrandPhoto } from '@/components/ui/BrandPhoto'
import { cn } from '@/lib/utils'
import { profileSnapshot, useStore } from '@/store'
import { useSession, useSignOut } from '@/lib/useSession'
import { VARIABLE_CATALOG } from '@/lib/compat/config'
import { formatSelfValue } from '@/lib/compat/format'
import { draftProgress, isVariableComplete } from '@/lib/compat/onboardingDraft'
import { LIVE } from '@/lib/live'
import { SecurityCard } from '@/components/profile/SecurityCard'
import { cvFromMember } from '@/lib/profile/cv'
import { PROFILE_LAYOUTS, normalizeLayout } from '@/lib/profile/layouts'
import { validateGateQuestions } from '@/lib/verification/validate'
import { profileApi } from '@/services/profile'

const PREMIUM = [
  'See who liked your profile before you like back',
  '15 profiles per day, against 5 on the free plan',
  'Advanced filters for the people you want to meet',
  'Undo your last pass if you change your mind',
  'Unlimited quiz retries with no daily cap',
]

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

export default function ProfilePage() {
  const router = useRouter()
  const user = useStore((s) => s.user)
  const toast = useStore((s) => s.toast)
  const signOut = useSignOut()
  const { session } = useSession()
  const isTester = session?.user?.role === 'admin' || session?.user?.role === 'tester'
  const notificationsOn = useStore((s) => s.notificationsOn)
  const toggleNotifications = useStore((s) => s.toggleNotifications)
  const ob = useStore((s) => s.onboarding)
  const aiDraft = useStore((s) => s.aiDraft)
  const patchAIDraft = useStore((s) => s.patchAIDraft)
  const compatDraft = useStore((s) => s.compatDraft)
  const gateQuestions = useStore((s) => s.gateQuestions)
  const poolPicks = useStore((s) => s.poolPicks)

  const compat = draftProgress(compatDraft)
  const gateValid = validateGateQuestions(gateQuestions.map((q) => ({ ...q, distractors: q.distractors.filter(Boolean) }))).length === 0
  const storyDone = ob.headline.trim().length > 0 && wordCount(aiDraft.rawText) >= 15
  const identityDone = Boolean(ob.gender && ob.city && ob.intent)
  const layout = normalizeLayout(aiDraft.layout)

  // A real, computed completeness score, weighted toward the compatibility
  // engine since that's what actually drives match quality (§ scoring spec).
  const profileScore = Math.round(
    (compat.complete / compat.total) * 45 +
      (storyDone ? 20 : ob.headline ? 8 : 0) +
      (identityDone ? 15 : 0) +
      (gateValid ? 15 : poolPicks.length > 0 ? 5 : 0) +
      (ob.lifestyle.length > 0 ? 5 : 0),
  )

  const cv = useMemo(
    () => cvFromMember({ username: user.username, onboarding: ob, compat: compatDraft, ai: aiDraft }),
    [user.username, ob, compatDraft, aiDraft],
  )

  function chooseLayout(id: (typeof PROFILE_LAYOUTS)[number]['id']) {
    patchAIDraft({ layout: id })
    void profileApi.save(profileSnapshot(useStore.getState())).catch(() => undefined)
  }

  const edit = (step: number) => router.push(`/onboarding?step=${step}`)

  return (
    <div className="mx-auto max-w-content px-5 py-7 lg:px-10 lg:py-9">
      <PageHeader
        title="Your profile"
        subtitle="This is what a match sees: words only, never a photo"
        actions={
          <Button block={false} size="sm" variant="secondary" onClick={() => edit(2)}>
            <Pencil size={14} /> Edit profile
          </Button>
        }
      />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* the profile, as a CV */}
        <div className="min-w-0">
          <ProfileCVView cv={cv} layout={layout} />
        </div>

        {/* right rail: completeness, trust, design */}
        <aside className="space-y-4">
          <div className="rounded-2xl border border-warm-100 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="text-[13.5px] font-semibold text-warm-900">Profile {profileScore}% complete</div>
              <span className="font-serif-i text-[18px] text-brand-700">{profileScore}%</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-warm-100">
              <div className="h-full rounded-full bg-brand-cta transition-[width] duration-700" style={{ width: `${profileScore}%` }} />
            </div>
            {!LIVE && <p className="mt-2 text-[12px] leading-snug text-warm-500">Profiles above 90% get 3× more connections.</p>}
            {/* attendance and respect only mean something once dates have happened; real accounts do not show invented numbers */}
            {!LIVE && (
            <div className="mt-4 grid grid-cols-3 divide-x divide-warm-100 border-t border-warm-100 pt-3">
              {[
                ['100%', 'Attendance'],
                ['4.9', 'Respect'],
                ['0', 'Reports'],
              ].map(([v, l]) => (
                <div key={l} className="px-1 text-center">
                  <div className="font-serif-i text-[17px] text-brand-700">{v}</div>
                  <div className="mt-0.5 text-[10px] text-warm-400">{l}</div>
                </div>
              ))}
            </div>
            )}
          </div>

          <div className="flex items-center gap-3 rounded-2xl border border-brand-100 bg-brand-50 p-4">
            <ShieldCheck size={22} className="flex-shrink-0 text-brand-700" />
            <div>
              <div className="text-[13.5px] font-semibold text-brand-800">Tier {user.trustTier}: Verified member</div>
              <div className="text-[11.5px] text-brand-600">ID checked · Email confirmed</div>
            </div>
          </div>

          <SecurityCard />

          <div className="rounded-2xl border border-warm-100 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <span className="sec-lbl !mb-0">Profile design</span>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {PROFILE_LAYOUTS.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => chooseLayout(l.id)}
                  aria-pressed={layout === l.id}
                  className={cn(
                    'rounded-xl border-[1.5px] p-2 text-left transition-colors',
                    layout === l.id ? 'border-brand-600 bg-brand-50' : 'border-[var(--bdr)] bg-[var(--card)]',
                  )}
                >
                  <LayoutThumb id={l.id} />
                  <div className="mt-1.5 flex items-center justify-between text-[12px] font-semibold text-warm-800">
                    {l.label}
                    {layout === l.id && <Check size={13} className="text-brand-700" />}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </aside>
      </div>

      <div className="mt-8 space-y-5">
        <Panel title="My compatibility answers" editLabel={`${compat.complete}/${compat.total} rated · Edit`} onEdit={() => edit(3)}>
          <div className="grid gap-x-8 sm:grid-cols-2">
            {VARIABLE_CATALOG.map((config) => {
              const variable = compatDraft[config.field]
              const complete = isVariableComplete(config, variable)
              const value = formatSelfValue(config, variable?.self)
              return (
                <div key={config.field} className="flex items-start justify-between gap-3 border-b border-warm-100 py-3 last:border-none">
                  <div>
                    <div className="mb-0.5 text-[12px] text-warm-400">{config.label}</div>
                    <div className={complete ? 'text-[14px] font-semibold text-warm-900' : 'text-[13px] text-warm-400'}>
                      {complete ? value : 'Not yet rated'}
                    </div>
                  </div>
                  {complete && variable.dealbreaker && <span className="q-picked mt-0.5 flex-shrink-0 !text-[11px]">Dealbreaker</span>}
                </div>
              )
            })}
          </div>
        </Panel>

        <Panel title="Read-check questions" editLabel="Edit" onEdit={() => edit(4)}>
          {poolPicks.length ? (
            <div className="grid gap-x-8 sm:grid-cols-2">
              {poolPicks.map((q) => (
                <div key={q.id} className="border-b border-warm-100 py-3 last:border-none">
                  <div className="mb-0.5 text-[12px] text-warm-400">{q.question}</div>
                  <div className="text-[14px] font-semibold text-warm-900">{q.answer}</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[13.5px] text-warm-400">
              No read-check questions yet. Matches must pass one before they can like your profile.
            </p>
          )}
        </Panel>

        <div className="relative isolate overflow-hidden rounded-2xl p-6 text-white sm:p-8">
          <BrandPhoto name="laugh" position="60% 40%" className="absolute inset-0 -z-20 h-full w-full" />
          <div className="absolute inset-0 -z-10" style={{ background: 'linear-gradient(120deg, rgba(27,10,61,0.92), rgba(87,20,184,0.80) 60%, rgba(236,72,153,0.60))' }} />
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/5" />
          <div className="relative grid gap-6 sm:grid-cols-[1fr_auto] sm:items-center">
            <div>
              <div className="font-serif text-[22px]">Upgrade to Plus</div>
              <div className="mt-1 text-[13px] text-white/65">Better matches · more control · more dates</div>
              <ul className="mt-4 grid gap-1.5 sm:grid-cols-2">
                {PREMIUM.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-[12.5px] text-white/80">
                    <Check size={14} className="mt-0.5 flex-shrink-0 text-brand-300" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
            <Button variant="white" block={false} className="self-start" onClick={() => toast('Premium plans launch at the end of the pilot')}>
              See plans →
            </Button>
          </div>
        </div>

        <Panel title="Settings">
          <SettingRow icon={SlidersHorizontal} bg="bg-brand-50" label="Match filters & preferences" onClick={() => edit(6)} />
          {isTester && <SettingRow icon={Users} bg="bg-amber-50" label="Members (testing view)" onClick={() => router.push('/members')} />}
          <div className="flex items-center border-b border-warm-100 py-3">
            <span className="set-icon bg-amber-50">
              <Bell size={16} />
            </span>
            <span className="flex-1 text-[14px] font-medium text-warm-800">Push notifications</span>
            <button
              className={'toggle' + (notificationsOn ? ' on' : '')}
              onClick={() => {
                toggleNotifications()
                toast(notificationsOn ? 'Notifications off' : 'Notifications on')
              }}
              aria-label="Toggle notifications"
            >
              <span className="tthumb" />
            </button>
          </div>
          <SettingRow icon={Lock} bg="bg-purple-50" label="Privacy policy" onClick={() => window.open('/privacy', '_blank')} />
          <SettingRow icon={ShieldAlert} bg="bg-coral-50" label="Safety centre" onClick={() => toast('The safety centre is available in the full app')} />
          <button className="flex w-full items-center py-3 text-left" onClick={signOut}>
            <span className="set-icon bg-warm-100">
              <LogOut size={16} />
            </span>
            <span className="flex-1 text-[14px] font-medium text-danger">Sign out</span>
          </button>
        </Panel>
      </div>
    </div>
  )
}

function Panel({
  title,
  children,
  onEdit,
  editLabel = 'Edit',
}: {
  title: string
  children: React.ReactNode
  onEdit?: () => void
  editLabel?: string
}) {
  return (
    <div className="rounded-2xl border border-warm-100 bg-white p-6 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <span className="sec-lbl !mb-0">{title}</span>
        {onEdit && (
          <button className="text-[12px] font-semibold text-brand-700 hover:underline" onClick={onEdit}>
            {editLabel}
          </button>
        )}
      </div>
      {children}
    </div>
  )
}

function SettingRow({
  icon: Icon,
  bg,
  label,
  onClick,
}: {
  icon: LucideIcon
  bg: string
  label: string
  onClick: () => void
}) {
  return (
    <button className="flex w-full items-center border-b border-warm-100 py-3 text-left" onClick={onClick}>
      <span className={`set-icon ${bg}`}>
        <Icon size={16} />
      </span>
      <span className="flex-1 text-[14px] font-medium text-warm-800">{label}</span>
      <ChevronRight size={16} className="text-warm-300" />
    </button>
  )
}
