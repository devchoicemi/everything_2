import type { Metadata } from 'next'
import { CONTACT_EMAIL, LegalPage, Section, Table, Ul } from '@/components/legal/LegalPage'

export const metadata: Metadata = {
  title: 'Privacy Policy | ChoiceMi',
  description: 'What ChoiceMi collects, why, who sees it, how long we keep it, and your rights.',
}

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      intro="ChoiceMi is anonymous, compatibility-first dating. Profiles have no photos and no real names. This page explains, in plain language, what personal data we collect, why, who handles it, how long we keep it, and what you can do about it."
    >
      <Section title="1. Who is responsible">
        <p>
          ChoiceMi (the operator of choicemi.com, Helsinki, Finland) is the controller of your personal data. You can reach us at{' '}
          <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold text-brand-700">
            {CONTACT_EMAIL}
          </a>{' '}
          for anything in this policy.
        </p>
      </Section>

      <Section title="2. What we collect and why">
        <span id="cookies" />
        <Table
          head={['Data', 'Why we use it', 'Basis', 'How long']}
          rows={[
            [
              'Waitlist: your email address and the time you agreed',
              'To email you your invitation and news about the launch',
              'Your consent',
              'Until you unsubscribe, or you create an account and later delete it',
            ],
            [
              'Account: email, a one-way hash of your password, your confirmation that you are 18 or older and accepted our terms',
              'To create and secure your account and let you sign in',
              'Contract (providing the service)',
              'Until you delete your account',
            ],
            [
              'Identity check: your verified legal name, a pseudonymous identifier from the identity service, which method you used (for example a Finnish bank), and whether you are over 18',
              'To keep out fakes, minors and repeat accounts, and to investigate abuse or safety reports',
              'Legitimate interests (fraud prevention and member safety)',
              'Until you delete your account. The name is stored encrypted and read only by authorised staff, and every access is logged.',
            ],
            [
              'Your profile: the answers you give while setting up, such as your headline and story, lifestyle, height, what you look for in a partner, your read-check choices and date preferences',
              'To build your profile, match you with other members and arrange dates',
              'Your explicit consent for sensitive details (such as who you are interested in and how important faith is), and contract for the rest',
              'Until you delete your account',
            ],
            [
              'Security records: sign-in and sign-out events, time, IP address and browser type',
              'To detect break-ins, abuse and automated attacks',
              'Legitimate interests (security)',
              'Up to 90 days',
            ],
            [
              'Session cookie',
              'To keep you signed in',
              'Strictly necessary',
              'Up to 30 days, or until you sign out',
            ],
          ]}
        />
        <p>
          We do <strong>not</strong> collect or store your Finnish personal identity code or your date of birth. The identity service tells us only
          whether you are over 18.
        </p>
      </Section>

      <Section title="3. Sensitive details you choose to give">
        <p>
          Some answers can reveal sensitive things, such as who you are interested in or how important faith is to you. We only use them to match
          you, and only after you tick a box giving your explicit consent when you set up your profile. You can withdraw that consent at any
          time by writing to us, and we will remove those answers.
        </p>
      </Section>

      <Section title="4. What other members can see">
        <p>
          Other members never see your email address, your real name, or how you verified. Profiles use a system-generated anonymous username and
          words only, with no photos.
        </p>
      </Section>

      <Section title="5. Who handles your data for us">
        <p>We use a small number of providers (processors) who act only on our instructions:</p>
        <Table
          head={['Provider', 'What for', 'Where']}
          rows={[
            ['UpCloud', 'Servers and the database that hold your account', 'Helsinki, Finland'],
            ['Signicat', 'Identity verification through your bank or mobile ID', 'EU / EEA'],
            ['AhaSend (AhaSend B.V., the Netherlands)', 'Sending our emails (invitations, confirmations, password resets)', 'EU / EEA'],
          ]}
        />
        <p>
          We do not sell your data, and we do not use it for advertising. We do not currently send your text to any AI service. If that changes,
          we will tell you and ask first. Where a provider is outside the EU or EEA, we rely on recognised safeguards such as the EU Standard
          Contractual Clauses. We may disclose data if the law or a competent authority requires it.
        </p>
      </Section>

      <Section title="6. How we protect it">
        <Ul
          items={[
            'Everything travels over encrypted connections (HTTPS).',
            'Passwords are stored only as a salted one-way hash. We cannot read your password.',
            'Your verified name is encrypted in our database with a key kept separate from it.',
            'Sign-in attempts are rate limited, and access to administrator functions is restricted and logged.',
            'The database is backed up daily, and old backups are removed after 14 days.',
          ]}
        />
      </Section>

      <Section title="7. Your rights">
        <p>Under the GDPR you can ask us to:</p>
        <Ul
          items={[
            'show you the data we hold about you, and give you a copy;',
            'correct anything that is wrong;',
            'delete your data (right to erasure). Deleting your account removes your account, sessions, identity record and any waitlist entry;',
            'restrict or object to how we use it, where we rely on legitimate interests;',
            'withdraw your consent at any time. Every waitlist email has an unsubscribe link, and withdrawing does not affect what we did before.',
          ]}
        />
        <p>
          To use any of these rights, write to{' '}
          <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold text-brand-700">
            {CONTACT_EMAIL}
          </a>
          . We reply within one month. Self-service account deletion in the app is coming with the launch.
        </p>
        <p>
          If you think we have handled your data unlawfully, you can complain to the Finnish Data Protection Ombudsman (Tietosuojavaltuutetun
          toimisto, tietosuoja.fi) or to the authority in your own country.
        </p>
      </Section>

      <Section title="8. Age">
        <p>ChoiceMi is only for people aged 18 and over. We remove accounts that do not meet this.</p>
      </Section>

      <Section title="9. Changes to this policy">
        <p>
          If we change what we collect or why, we will update this page and the date at the top. For significant changes we will tell you by
          email before they apply.
        </p>
      </Section>
    </LegalPage>
  )
}
