/**
 * Where waitlist sign-ups are delivered. The address is the only thing to
 * change if it moves; the form posts through FormSubmit, which forwards each
 * entry to this inbox (the first submission triggers a one-time activation
 * email to this address).
 */
export const WAITLIST_EMAIL = 'admin@choicemi.com'
