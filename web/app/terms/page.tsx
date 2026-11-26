import type { Metadata } from 'next'
import Link from 'next/link'
import { CONTACT_EMAIL, LegalPage, Section, Ul } from '@/components/legal/LegalPage'

export const metadata: Metadata = {
  title: 'Terms of Use | ChoiceMi',
  description: 'The rules for using ChoiceMi: who can join, how to behave, and what we do in return.',
}

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Use"
      intro="These terms are the agreement between you and ChoiceMi when you join the waitlist, accept an invitation, or use the service. Please read them with our Privacy Policy."
    >
      <Section title="1. Who can join">
        <Ul
          items={[
            'You must be 18 or older.',
            'ChoiceMi is invitation-only for now. An invitation link works once, for the email address it was sent to, and expires after 14 days.',
            'You may have one account. You must be who you say you are and pass our identity check.',
            'You must give true information and keep your sign-in details to yourself.',
          ]}
        />
      </Section>

      <Section title="2. How ChoiceMi works">
        <p>
          ChoiceMi matches people by compatibility, using words rather than photos, and helps matched members arrange a first date in person at a
          partner venue. We do not guarantee any match, date or relationship.
        </p>
      </Section>

      <Section title="3. Identity check">
        <p>
          To use ChoiceMi you verify your identity once through our identity partner. You agree that we receive the result and your verified legal
          name from them and keep them as described in the{' '}
          <Link href="/privacy" className="font-semibold text-brand-700">
            Privacy Policy
          </Link>
          . Other members never see your real name.
        </p>
      </Section>

      <Section title="4. How to behave">
        <p>You agree not to:</p>
        <Ul
          items={[
            'harass, threaten, deceive, discriminate against or pressure anyone;',
            'impersonate another person, or use another person’s identity or account;',
            'share or ask for photos, contact details or other personal information in a way that breaks the no-photo rule or another member’s wishes;',
            'send spam, sell or promote anything, or use ChoiceMi for anything unlawful;',
            'try to break, overload, scrape or reverse-engineer the service, or get around its security or limits.',
          ]}
        />
        <p>
          Report anything concerning to{' '}
          <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold text-brand-700">
            {CONTACT_EMAIL}
          </a>
          . We may remove content, suspend or close an account, and give information to authorities where the law requires or safety demands it.
        </p>
      </Section>

      <Section title="5. Meeting in person">
        <p>
          Meeting someone from the internet carries risk. Meet in public places, tell a friend where you are going, and leave if you feel
          uncomfortable. ChoiceMi checks identity but cannot know everything about a member, and we are not responsible for what members do.
        </p>
      </Section>

      <Section title="6. Your account and content">
        <p>
          What you write remains yours. You give us permission to store it and show it to other members as the service works. Closing your
          account removes it, as described in the Privacy Policy. You can ask us to delete your account at any time.
        </p>
      </Section>

      <Section title="7. Fees">
        <p>
          Joining the waitlist and creating an account are free during the pilot. If we introduce paid features, we will describe the price and
          terms clearly before you pay.
        </p>
      </Section>

      <Section title="8. The service as it is">
        <p>
          We work to keep ChoiceMi running and safe, but it is provided as it is and may change, pause or be unavailable. To the extent the law
          allows, we are not liable for indirect losses, and nothing here limits liability that cannot be limited by law, including for death or
          personal injury caused by negligence, or for intentional or grossly negligent acts.
        </p>
      </Section>

      <Section title="9. Ending your membership">
        <p>
          You can stop using ChoiceMi and delete your account whenever you like. We may suspend or end your access if you break these terms or
          create risk for others.
        </p>
      </Section>

      <Section title="10. Changes and law">
        <p>
          We may update these terms. If a change matters, we will tell you before it applies. Finnish law governs these terms, and Finnish
          courts have jurisdiction, but if you are a consumer you keep any mandatory rights you have in your own country.
        </p>
      </Section>
    </LegalPage>
  )
}
