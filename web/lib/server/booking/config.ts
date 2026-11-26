/**
 * The numbers the booking flow runs on. The spec calls these configuration values, so the pilot can
 * change them in the environment without a rebuild: BOOKING_WINDOW_FROM_DAY=4 and so on. Read at call time.
 */
const num = (name: string, fallback: number) => {
  const v = Number(process.env[name])
  return Number.isFinite(v) && process.env[name] !== undefined && process.env[name] !== '' ? v : fallback
}

export const cfg = () => ({
  /** first dates fall between day 5 and day 10 after the match */
  windowFromDay: num('BOOKING_WINDOW_FROM_DAY', 5),
  windowToDay: num('BOOKING_WINDOW_TO_DAY', 10),
  /** options reminder: nobody has sent options this long after the match */
  firstOptionsHours: num('BOOKING_FIRST_OPTIONS_HOURS', 24),
  /** each answer to a set of options */
  answerHours: num('BOOKING_ANSWER_HOURS', 24),
  /** the sender confirms a picked option */
  confirmHours: num('BOOKING_CONFIRM_HOURS', 12),
  /** the booking must reach the venue at least this long before the date */
  venueNoticeHours: num('BOOKING_VENUE_NOTICE_HOURS', 48),
  /** the venue answers within this long */
  venueResponseHours: num('BOOKING_VENUE_RESPONSE_HOURS', 24),
  /** the last date may start this long before closing */
  lastStartBeforeCloseMin: num('BOOKING_LAST_START_BEFORE_CLOSE_MIN', 90),
  qrBeforeMin: num('BOOKING_QR_BEFORE_MIN', 30),
  qrAfterMin: num('BOOKING_QR_AFTER_MIN', 30),
  noShowGraceMin: num('BOOKING_NO_SHOW_GRACE_MIN', 20),
  /** cancelling this close to the date counts on the dater's record */
  lateCancelHours: num('BOOKING_LATE_CANCEL_HOURS', 24),
  feedbackDays: num('BOOKING_FEEDBACK_DAYS', 7),
  feedbackReminderHours: num('BOOKING_FEEDBACK_REMINDER_HOURS', 24),
  /** a venue sees its average only after this many ratings */
  minRatings: num('BOOKING_MIN_RATINGS', 5),
  /** booking details leave the venue portal this long after the date */
  venueRetentionDays: num('BOOKING_VENUE_RETENTION_DAYS', 30),
  /** each dater may send options at most this many times (A, B, A, B) */
  turnsEach: num('BOOKING_TURNS_EACH', 2),
  optionsPerSet: 3,
})

/** The preset reasons for "None of these". No free text, keeping the no-chat rule. */
export const NONE_REASONS = ['dates', 'times', 'venues'] as const
export type NoneReason = (typeof NONE_REASONS)[number]
export const NONE_REASON_TEXT: Record<NoneReason, string> = {
  dates: "Dates don't work",
  times: "Times don't work",
  venues: "Venues don't suit",
}

export const STATUS_LIVE = ['proposed', 'picked', 'requested', 'confirmed', 'partially_checked_in', 'in_progress'] as const
export type BookingStatus =
  | 'proposed'
  | 'picked'
  | 'requested'
  | 'confirmed'
  | 'partially_checked_in'
  | 'in_progress'
  | 'ended'
  | 'declined'
  | 'expired'
  | 'closed'
  | 'cancelled'
  | 'no_show'
