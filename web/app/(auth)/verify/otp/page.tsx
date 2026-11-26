import { redirect } from 'next/navigation'

// The phone-code step was replaced by sign-in + identity verification.
export default function OtpPage() {
  redirect('/verify')
}
