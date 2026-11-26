'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { BookOpen, Check, Clock } from 'lucide-react'
import { Modal } from '@/components/common/Modal'
import { cn } from '@/lib/utils'
import { verificationService } from '@/services/api'
import type { AttemptStatus, PublicQuestion } from '@/lib/verification/types'

/**
 * The profile-reading verification gate. Everything here is a thin view over
 * the server: `start`/`answer` calls decide correctness, attempt counts, and
 * blocking — this component never checks an answer itself, and reloading the
 * page mid-attempt would resume the same server session rather than reset it.
 */
export function QuizModal({
  targetId,
  targetName,
  open,
  onClose,
  onPass,
}: {
  targetId: string | null
  targetName?: string
  open: boolean
  onClose: () => void
  onPass: () => void
}) {
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<AttemptStatus>('active')
  const [question, setQuestion] = useState<PublicQuestion | null>(null)
  const [attemptsUsed, setAttemptsUsed] = useState(0)
  const [picked, setPicked] = useState<string | null>(null)
  const [feedback, setFeedback] = useState('')
  const [showResult, setShowResult] = useState(false)
  const [blockedUntil, setBlockedUntil] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !targetId) return
    let cancelled = false
    setLoading(true)
    setError(null)
    verificationService
      .start(targetId)
      .then((res) => {
        if (cancelled) return
        setStatus(res.status)
        setQuestion(res.question)
        setAttemptsUsed(res.attemptsUsed)
        setBlockedUntil(res.blockedUntil)
        setPicked(null)
        setShowResult(false)
        setFeedback('')
        // Reopening a read-check already passed earlier — the server has no
        // question to serve (by design, see gate.ts). Let the caller through
        // immediately instead of leaving the modal blank with nothing to click.
        if (res.status === 'passed') {
          setTimeout(() => {
            if (cancelled) return
            onClose()
            onPass()
          }, 700)
        }
      })
      .catch((e) => !cancelled && setError(e instanceof Error && e.message ? e.message : 'Could not load the read-check. Please try again.'))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, targetId])

  async function select(option: string) {
    if (busy || !question || !targetId || showResult) return
    setBusy(true)
    setPicked(option)
    try {
      const res = await verificationService.answer(targetId, question.questionId, option)
      setStatus(res.status)
      setAttemptsUsed(res.attemptsUsed)
      setBlockedUntil(res.blockedUntil)
      setFeedback(res.feedback)
      setShowResult(true)

      if (res.correct) {
        setTimeout(() => {
          onClose()
          onPass()
        }, 950)
      } else if (res.status === 'blocked') {
        // stay on the blocked screen
      } else {
        setTimeout(() => {
          setQuestion(res.nextQuestion)
          setPicked(null)
          setShowResult(false)
          setFeedback('')
        }, 1600)
      }
    } catch {
      setError('Something went wrong submitting your answer. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const cooldownLabel = blockedUntil ? formatCooldown(blockedUntil) : null

  return (
    <Modal open={open} onClose={onClose} dismissable={!busy}>
      <div className="mb-4 flex items-center gap-3">
        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
          <BookOpen size={18} />
        </span>
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-amber-600">
            Read-check
          </div>
          <div className="mt-px text-[13px] text-warm-500">
            {targetName ? `One question from ${targetName}'s profile` : 'One question from their profile'}
          </div>
        </div>
      </div>

      {loading && <div className="py-8 text-center text-[13px] text-warm-400">Loading your read-check…</div>}

      {error && <div className="rounded-xl bg-danger-50 px-4 py-3 text-[13px] text-danger">{error}</div>}

      {!loading && !error && status === 'passed' && !question && (
        <div className="rounded-xl border border-brand-100 bg-brand-50 px-4 py-5 text-center">
          <Check size={22} className="mx-auto mb-2 text-brand-600" />
          <div className="text-[14px] font-semibold text-brand-800">Already passed</div>
          <p className="mt-1 text-[13px] text-warm-600">You read this profile and passed the read-check already.</p>
        </div>
      )}

      {!loading && !error && status === 'blocked' && (
        <div className="rounded-xl border border-danger/20 bg-danger-50 px-4 py-5 text-center">
          <Clock size={22} className="mx-auto mb-2 text-danger" />
          <div className="text-[14px] font-semibold text-danger">Read-check temporarily locked</div>
          <p className="mt-1 text-[13px] text-warm-600">
            Three attempts used. Try again{cooldownLabel ? ` in ${cooldownLabel}` : ' later'}. Take the
            time to reread their profile.
          </p>
        </div>
      )}

      {!loading && !error && status !== 'blocked' && question && (
        <AnimatePresence mode="wait">
          <motion.div
            key={question.questionId}
            initial={{ opacity: 0, x: 14 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -14 }}
            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
          >
            <motion.p
              className="font-serif text-[20px] leading-snug text-warm-900"
              animate={status === 'passed' ? { scale: [1, 1.03, 1] } : undefined}
              transition={{ duration: 0.4 }}
            >
              {question.question}
            </motion.p>

            <div className="my-4 flex items-center gap-1.5">
              {[0, 1, 2].map((i) => (
                <span key={i} className={cn('quiz-attempt-dot', i < attemptsUsed && 'used')} />
              ))}
              <span className="ml-2 text-[12px] text-warm-400">{3 - attemptsUsed} attempts left</span>
            </div>

            {feedback && (
              <motion.div
                key={feedback}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn('mb-3 min-h-[18px] text-[13px]', status === 'passed' ? 'font-medium text-brand-600' : 'text-danger')}
              >
                {feedback}
              </motion.div>
            )}

            <div className="space-y-2">
              {question.options.map((o) => {
                const isPicked = picked === o
                const state = showResult ? (isPicked ? (status === 'passed' ? 'correct' : 'wrong') : 'dimmed') : undefined
                return (
                  <motion.button
                    key={o}
                    type="button"
                    onClick={() => select(o)}
                    disabled={busy || showResult}
                    whileTap={!showResult ? { scale: 0.98 } : undefined}
                    animate={isPicked && status === 'passed' ? { scale: [1, 1.02, 1] } : undefined}
                    transition={{ duration: 0.3 }}
                    className={cn('quiz-opt w-full text-left', state)}
                  >
                    <span className="qo-ind">
                      {showResult && isPicked && status === 'passed' && (
                        <Check size={10} className="text-white" strokeWidth={3} />
                      )}
                    </span>
                    <span className="flex-1">{o}</span>
                  </motion.button>
                )
              })}
            </div>
          </motion.div>
        </AnimatePresence>
      )}
    </Modal>
  )
}

function formatCooldown(blockedUntil: number): string {
  const ms = blockedUntil - Date.now()
  if (ms <= 0) return 'a moment'
  const hours = Math.ceil(ms / (60 * 60 * 1000))
  return hours <= 1 ? 'about an hour' : `about ${hours} hours`
}
