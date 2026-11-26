/**
 * Schema migrations, applied in order and recorded in `schema_migrations`.
 * Append new entries; never edit one that has shipped.
 *
 * Kept as strings (not .sql files) so they are bundled into the Docker/standalone
 * build without any file-tracing surprises.
 */
export interface Migration {
  id: string
  sql: string
}

export const MIGRATIONS: Migration[] = [
  {
    id: '0001_auth',
    sql: `
      create table users (
        id uuid primary key default gen_random_uuid(),
        email text not null unique,
        password_hash text not null,
        role text not null default 'member' check (role in ('member', 'partner', 'admin')),
        status text not null default 'active' check (status in ('active', 'suspended')),
        email_verified_at timestamptz,
        terms_version text not null,
        terms_accepted_at timestamptz not null,
        over18_declared_at timestamptz not null,
        identity_verified_at timestamptz,
        password_changed_at timestamptz not null default now(),
        last_login_at timestamptz,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );

      -- One row per verified identity. Only what the product needs is kept:
      -- the provider's pseudonymous subject (to stop one person opening many
      -- accounts), the idp, and an over-18 flag. No name, no national ID,
      -- no date of birth.
      create table identities (
        id uuid primary key default gen_random_uuid(),
        user_id uuid not null references users(id) on delete cascade,
        provider text not null,
        subject text not null,
        idp text,
        over18 boolean not null,
        verified_at timestamptz not null default now(),
        created_at timestamptz not null default now(),
        unique (provider, subject),
        unique (user_id, provider)
      );

      -- Only the SHA-256 of the session token is stored; the token itself lives
      -- in the browser's httpOnly cookie.
      create table sessions (
        id uuid primary key default gen_random_uuid(),
        user_id uuid not null references users(id) on delete cascade,
        token_hash text not null unique,
        created_at timestamptz not null default now(),
        last_seen_at timestamptz not null default now(),
        expires_at timestamptz not null,
        revoked_at timestamptz,
        user_agent text,
        ip text
      );
      create index sessions_user_idx on sessions(user_id);

      create table email_tokens (
        id uuid primary key default gen_random_uuid(),
        user_id uuid not null references users(id) on delete cascade,
        purpose text not null check (purpose in ('verify_email', 'reset_password')),
        token_hash text not null unique,
        expires_at timestamptz not null,
        used_at timestamptz,
        created_at timestamptz not null default now()
      );
      create index email_tokens_user_idx on email_tokens(user_id, purpose);

      -- Pending OpenID Connect logins (Signicat). Short-lived, single use.
      create table oidc_flows (
        state text primary key,
        user_id uuid not null references users(id) on delete cascade,
        nonce text not null,
        code_verifier text not null,
        return_to text not null,
        created_at timestamptz not null default now(),
        expires_at timestamptz not null,
        consumed_at timestamptz
      );

      create table rate_limits (
        key text primary key,
        count int not null,
        expires_at timestamptz not null
      );

      create table auth_events (
        id bigserial primary key,
        user_id uuid references users(id) on delete set null,
        type text not null,
        ip text,
        user_agent text,
        meta jsonb,
        created_at timestamptz not null default now()
      );
      create index auth_events_user_idx on auth_events(user_id, created_at desc);
    `,
  },
  {
    id: '0002_waitlist_invites',
    sql: `
      -- People who asked to be told when ChoiceMi opens. Email plus the consent
      -- they gave; nothing else. Removed entirely when they unsubscribe.
      create table waitlist (
        id uuid primary key default gen_random_uuid(),
        email text not null unique,
        status text not null default 'waiting' check (status in ('waiting', 'invited', 'joined')),
        consent_at timestamptz not null default now(),
        consent_text text not null,
        source text,
        invited_at timestamptz,
        joined_at timestamptz,
        created_at timestamptz not null default now()
      );
      create index waitlist_status_idx on waitlist(status, created_at);

      -- One-time invitation links. The emailed token is stored only as a hash.
      create table invites (
        id uuid primary key default gen_random_uuid(),
        email text not null,
        token_hash text not null unique,
        expires_at timestamptz not null,
        used_at timestamptz,
        user_id uuid references users(id) on delete set null,
        created_at timestamptz not null default now()
      );
      create index invites_email_idx on invites(email)
    `,
  },
  {
    id: '0003_identity_name',
    sql: `
      -- The verified legal name, kept for security and fraud investigations only.
      -- Encrypted with the application key (IDENTITY_DATA_KEY), never returned by
      -- any member-facing API, and deleted with the account.
      alter table identities add column name_enc text
    `,
  },
  {
    id: '0004_profiles_pool',
    sql: `
      -- The profile a member builds in onboarding, saved to their account so it follows them
      -- across sign-outs and devices. onboarded_at is set once they finish setup.
      create table member_profiles (
        user_id uuid primary key references users(id) on delete cascade,
        data jsonb not null default '{}'::jsonb,
        onboarded_at timestamptz,
        updated_at timestamptz not null default now()
      );

      -- Questions members pick from for their read-check, each with suggested answers.
      -- Seeded from lib/questions.ts; add more as the community grows.
      create table question_pool (
        id text primary key,
        theme text not null,
        question text not null,
        options jsonb not null,
        active boolean not null default true,
        sort_order int not null default 0,
        created_at timestamptz not null default now()
      );
      create index question_pool_theme_idx on question_pool(theme, sort_order)
    `,
  },
  {
    id: '0005_compat_members',
    sql: `
      -- Every member gets a system-generated anonymous username; it is what other members see.
      alter table users add column username text;
      update users set username = 'Member_' || substr(md5(id::text), 1, 6) where username is null;
      alter table users alter column username set not null;
      create unique index users_username_idx on users (lower(username));

      -- 'tester' accounts can use the app before launch (like admin) so dating and matching can be tried.
      alter table users drop constraint users_role_check;
      alter table users add constraint users_role_check check (role in ('member', 'partner', 'admin', 'tester'));

      -- The compatibility inputs from the scoring spec: per member and variable, their own value (self),
      -- how they rate each possible partner value (ideal), importance (weight) and dealbreaker.
      create table compat_variables (
        user_id uuid not null references users(id) on delete cascade,
        field text not null,
        self jsonb not null,
        ideal jsonb not null,
        weight int not null check (weight between 10 and 100),
        dealbreaker boolean not null default false,
        updated_at timestamptz not null default now(),
        primary key (user_id, field)
      )
    `,
  },
  {
    id: '0006_social',
    sql: `
      -- The read-check: one row per (reader, member read). Same policy as before: 3 wrong answers
      -- blocks that pair for 24 hours, and the same question is served until it is answered.
      create table gate_attempts (
        reader_id uuid not null references users(id) on delete cascade,
        target_id uuid not null references users(id) on delete cascade,
        status text not null check (status in ('active', 'passed', 'blocked')),
        attempts_used int not null default 0,
        asked_ids jsonb not null default '[]',
        current_question_id text,
        blocked_until timestamptz,
        passed_at timestamptz,
        updated_at timestamptz not null default now(),
        primary key (reader_id, target_id)
      );

      -- A like or a pass. One per direction; a mutual like becomes a match.
      create table reactions (
        from_user uuid not null references users(id) on delete cascade,
        to_user uuid not null references users(id) on delete cascade,
        kind text not null check (kind in ('like', 'pass')),
        created_at timestamptz not null default now(),
        primary key (from_user, to_user),
        check (from_user <> to_user)
      );
      create index reactions_to_idx on reactions(to_user, kind);

      -- user_a < user_b always, so a pair can only ever be one row.
      create table matches (
        id uuid primary key default gen_random_uuid(),
        user_a uuid not null references users(id) on delete cascade,
        user_b uuid not null references users(id) on delete cascade,
        status text not null default 'active' check (status in ('active', 'unmatched')),
        created_at timestamptz not null default now(),
        expires_at timestamptz,
        unique (user_a, user_b),
        check (user_a < user_b)
      );
      create index matches_a_idx on matches(user_a);
      create index matches_b_idx on matches(user_b);

      create table venues (
        id text primary key,
        name text not null,
        area text not null,
        kind text not null,
        offer text not null,
        capacity int not null default 4 check (capacity > 0),
        active boolean not null default true,
        sort_order int not null default 0
      );
      insert into venues (id, name, area, kind, offer, sort_order) values
        ('kaffa-roastery', 'Kaffa Roastery', 'Punavuori', 'Specialty coffee · Quiet · Recommended', '10% off for ChoiceMi dates', 1),
        ('good-life-coffee', 'Good Life Coffee', 'Kruununhaka', 'Third-wave coffee · Calm', 'Free refill on first date', 2),
        ('cafe-regatta', 'Café Regatta', 'Töölö', 'Lakeside café · Cosy · Romantic', 'Complimentary pastry', 3),
        ('fazer-cafe', 'Fazer Café', 'Kluuvi', 'Classic Finnish café · Central', '10% off for ChoiceMi dates', 4);

      -- A date proposal. No message field by design. start_at is the venue-local wall clock
      -- (Europe/Helsinki) turned into an instant.
      create table dates (
        id uuid primary key default gen_random_uuid(),
        match_id uuid not null references matches(id) on delete cascade,
        proposer_id uuid not null references users(id) on delete cascade,
        invitee_id uuid not null references users(id) on delete cascade,
        venue_id text not null references venues(id),
        date_on date not null,
        start_time text not null,
        start_at timestamptz not null,
        status text not null default 'pending' check (status in ('pending', 'confirmed', 'completed', 'declined', 'cancelled', 'expired')),
        created_at timestamptz not null default now(),
        responded_at timestamptz,
        cancelled_by uuid references users(id) on delete set null
      );
      create index dates_proposer_idx on dates(proposer_id);
      create index dates_invitee_idx on dates(invitee_id);
      create index dates_slot_idx on dates(venue_id, date_on, start_time) where status in ('pending', 'confirmed');
      create unique index dates_one_open_per_match on dates(match_id) where status in ('pending', 'confirmed');

      -- After-date feedback: structured answers only, never free text.
      create table date_feedback (
        date_id uuid not null references dates(id) on delete cascade,
        user_id uuid not null references users(id) on delete cascade,
        stars int not null check (stars between 1 and 5),
        answers jsonb not null,
        created_at timestamptz not null default now(),
        primary key (date_id, user_id)
      );

      create table redate_requests (
        date_id uuid not null references dates(id) on delete cascade,
        user_id uuid not null references users(id) on delete cascade,
        created_at timestamptz not null default now(),
        primary key (date_id, user_id)
      )
    `,
  },
  {
    id: '0007_otp_passkeys',
    sql: `
      -- One-time email codes (6 digits). Only a hash is stored. A login code belongs to a challenge
      -- (a random token the browser holds) so a code cannot be used without the password step first.
      create table otp_codes (
        id uuid primary key default gen_random_uuid(),
        user_id uuid not null references users(id) on delete cascade,
        purpose text not null check (purpose in ('verify_email', 'login')),
        challenge_hash text unique,
        code_hash text not null,
        attempts int not null default 0,
        resends int not null default 0,
        expires_at timestamptz not null,
        used_at timestamptz,
        created_at timestamptz not null default now()
      );
      create index otp_codes_user_idx on otp_codes(user_id, purpose);

      -- Passkeys (WebAuthn). The server keeps only the public key; the private key never leaves the device.
      create table passkeys (
        id uuid primary key default gen_random_uuid(),
        user_id uuid not null references users(id) on delete cascade,
        credential_id text not null unique,
        public_key text not null,
        counter bigint not null default 0,
        transports jsonb,
        device_type text,
        backed_up boolean not null default false,
        name text not null,
        created_at timestamptz not null default now(),
        last_used_at timestamptz
      );
      create index passkeys_user_idx on passkeys(user_id);

      -- Challenges handed to the browser for adding a passkey (user known) or signing in with one (user not yet known).
      create table webauthn_challenges (
        id uuid primary key default gen_random_uuid(),
        user_id uuid references users(id) on delete cascade,
        purpose text not null check (purpose in ('register', 'login')),
        challenge text not null,
        expires_at timestamptz not null,
        used_at timestamptz
      )
    `,
  },
  {
    id: '0008_passkey_prompt',
    sql: `
      -- "Not now" on the passkey suggestion: do not ask again before this time.
      alter table users add column passkey_prompt_snoozed_until timestamptz
    `,
  },
  {
    id: '0009_partners',
    sql: `
      -- Restaurant partners: the venue's own details and when it can take dates.
      alter table venues add column description text not null default '';
      alter table venues add column address text not null default '';
      alter table venues add column city text not null default 'Helsinki';
      alter table venues add column phone text not null default '';
      alter table venues add column website text not null default '';
      alter table venues add column status text not null default 'active' check (status in ('pending', 'active', 'paused'));
      -- 0 = Sunday .. 6 = Saturday
      alter table venues add column open_days smallint[] not null default '{0,1,2,3,4,5,6}';
      alter table venues add column slot_times text[] not null default '{12:00,13:30,15:00,16:30,18:00,19:00}';

      -- Who can sign in to a venue's portal. 'owner' can also manage the team.
      create table venue_staff (
        user_id uuid not null references users(id) on delete cascade,
        venue_id text not null references venues(id) on delete cascade,
        role text not null default 'staff' check (role in ('owner', 'staff')),
        created_at timestamptz not null default now(),
        primary key (user_id, venue_id)
      );
      create index venue_staff_venue_idx on venue_staff(venue_id);

      -- Days or times a venue is not taking dates. A null start time closes the whole day.
      create table venue_closures (
        id uuid primary key default gen_random_uuid(),
        venue_id text not null references venues(id) on delete cascade,
        date_on date not null,
        start_time text,
        reason text not null default '',
        created_at timestamptz not null default now()
      );
      create unique index venue_closures_unique on venue_closures (venue_id, date_on, coalesce(start_time, ''));

      -- What happened at the venue. offer_code is what the guests show to claim the venue's offer.
      alter table dates add column offer_code text;
      alter table dates add column arrived_at timestamptz;
      alter table dates add column no_show_at timestamptz;
      alter table dates add column offer_redeemed_at timestamptz;
      alter table dates add column redeemed_by uuid references users(id) on delete set null;
      create unique index dates_offer_code_idx on dates(offer_code) where offer_code is not null;

      -- Restaurants asking to join. A person at ChoiceMi reviews each one.
      create table partner_applications (
        id uuid primary key default gen_random_uuid(),
        venue_name text not null,
        contact_name text not null,
        email text not null,
        phone text not null default '',
        address text not null default '',
        city text not null default 'Helsinki',
        notes text not null default '',
        status text not null default 'new' check (status in ('new', 'approved', 'rejected')),
        venue_id text references venues(id) on delete set null,
        created_at timestamptz not null default now(),
        reviewed_at timestamptz
      );
      create index partner_applications_status_idx on partner_applications(status, created_at);

      -- An invitation can make the new account a venue partner.
      alter table invites add column role text not null default 'member' check (role in ('member', 'partner'));
      alter table invites add column venue_id text references venues(id) on delete cascade;

      alter table users drop constraint users_role_check;
      alter table users add constraint users_role_check check (role in ('member', 'partner', 'admin', 'tester'))
    `,
  },
  {
    id: '0010_bookings_v2',
    sql: `
      -- The booking flow from the partner spec replaces the single proposal. The old tables held
      -- only test data, so they are dropped and rebuilt.
      drop table if exists date_feedback;
      drop table if exists redate_requests;
      drop table if exists dates cascade;

      -- What a venue must provide before it can go live.
      alter table venues add column business_id text;
      alter table venues add column ytj jsonb;
      alter table venues add column place_provider text;
      alter table venues add column place_id text;
      alter table venues add column lat double precision;
      alter table venues add column lng double precision;
      alter table venues add column formatted_address text;
      alter table venues add column contact_name text not null default '';
      alter table venues add column contact_role text not null default '';
      alter table venues add column contact_email text not null default '';
      alter table venues add column contact_email_verified_at timestamptz;
      alter table venues add column booking_phone text not null default '';
      alter table venues add column booking_phone_verified_at timestamptz;
      alter table venues add column step_free boolean;
      alter table venues add column accessible_toilet boolean;
      alter table venues add column price_level smallint check (price_level between 1 and 3);
      alter table venues add column hours jsonb not null default '{}';
      alter table venues add column review_status text not null default 'draft' check (review_status in ('draft', 'submitted', 'sent_back', 'approved'));
      alter table venues add column review jsonb not null default '{}';
      alter table venues add column submitted_at timestamptz;
      alter table venues add column reviewed_at timestamptz;
      alter table venues add column terms_accepted_at timestamptz;
      alter table venues add column photo_rights_at timestamptz;
      alter table venues add column marketing_photos boolean not null default false;
      alter table venues add column device_ready_at timestamptz;
      alter table venues add column staff_briefed_at timestamptz;
      alter table venues add column test_done_at timestamptz;
      alter table venues add column went_live_at timestamptz;
      -- the venues that were already live keep running; their opening hours become 10:00 to 22:00 on their open days
      update venues set review_status = 'approved', went_live_at = now(),
        hours = coalesce((select jsonb_object_agg(d::text, jsonb_build_object('open', '10:00', 'close', '22:00')) from unnest(open_days) as d), '{}'::jsonb);

      alter table venue_closures add column end_time text;

      -- The four photos: 1 outside, 2 entrance, 3 inside looking in, 4 inside looking back.
      create table venue_photos (
        venue_id text not null references venues(id) on delete cascade,
        slot int not null check (slot between 1 and 4),
        file_name text not null,
        mime text not null,
        width int not null,
        height int not null,
        bytes int not null,
        status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
        reject_reason text not null default '',
        checks jsonb not null default '{}',
        taken_on date,
        created_at timestamptz not null default now(),
        primary key (venue_id, slot)
      );

      create table phone_verifications (
        venue_id text primary key references venues(id) on delete cascade,
        phone text not null,
        code_hash text not null,
        attempts int not null default 0,
        expires_at timestamptz not null
      );
      create table venue_contact_tokens (
        token_hash text primary key,
        venue_id text not null references venues(id) on delete cascade,
        email text not null,
        expires_at timestamptz not null,
        used_at timestamptz
      );

      -- A booking, from the moment two people match to the feedback after the date.
      create table bookings (
        id uuid primary key default gen_random_uuid(),
        ref text not null unique,
        match_id uuid not null references matches(id) on delete cascade,
        user_a uuid not null references users(id) on delete cascade,
        user_b uuid not null references users(id) on delete cascade,
        kind text not null default 'first' check (kind in ('first', 'redate')),
        status text not null default 'proposed' check (status in ('proposed', 'picked', 'requested', 'confirmed', 'partially_checked_in', 'in_progress', 'ended', 'declined', 'expired', 'closed', 'cancelled', 'no_show')),
        window_start date not null,
        window_end date not null,
        first_sender uuid references users(id) on delete set null,
        turn_user uuid references users(id) on delete set null,
        rounds int not null default 0,
        deadline_at timestamptz,
        reminded_at timestamptz,
        picked_option_id uuid,
        sender_id uuid references users(id) on delete set null,
        venue_id text references venues(id),
        date_on date,
        start_time text,
        start_at timestamptz,
        requested_at timestamptz,
        venue_deadline_at timestamptz,
        confirmed_at timestamptz,
        venue_answered_by uuid references users(id) on delete set null,
        booking_code text,
        offer_claimed_at timestamptz,
        started_at timestamptz,
        ended_at timestamptz,
        ended_by text check (ended_by in ('both_left', 'staff', 'auto')),
        cancelled_at timestamptz,
        cancelled_by uuid references users(id) on delete set null,
        cancelled_role text check (cancelled_role in ('dater', 'venue', 'system')),
        late_cancel boolean not null default false,
        no_show_at timestamptz,
        no_show_by text check (no_show_by in ('dater', 'venue')),
        no_show_user uuid references users(id) on delete set null,
        closed_reason text,
        day_before_sent_at timestamptz,
        two_hours_sent_at timestamptz,
        feedback_reminded_at timestamptz,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );
      create index bookings_match_idx on bookings(match_id);
      create index bookings_a_idx on bookings(user_a);
      create index bookings_b_idx on bookings(user_b);
      create index bookings_venue_idx on bookings(venue_id, date_on) where venue_id is not null;
      create index bookings_status_idx on bookings(status, deadline_at);
      -- one live booking per match at a time
      create unique index bookings_one_live_per_match on bookings(match_id) where status in ('proposed', 'picked', 'requested', 'confirmed', 'partially_checked_in', 'in_progress');

      create table booking_options (
        id uuid primary key default gen_random_uuid(),
        booking_id uuid not null references bookings(id) on delete cascade,
        round int not null,
        sent_by uuid not null references users(id) on delete cascade,
        venue_id text not null references venues(id),
        date_on date not null,
        start_time text not null,
        start_at timestamptz not null,
        status text not null default 'offered' check (status in ('offered', 'picked', 'turned_down', 'expired')),
        created_at timestamptz not null default now()
      );
      create index booking_options_booking_idx on booking_options(booking_id, round);

      -- Each "None of these", with its preset reasons.
      create table booking_turns (
        id bigserial primary key,
        booking_id uuid not null references bookings(id) on delete cascade,
        round int not null,
        actor uuid not null references users(id) on delete cascade,
        action text not null check (action in ('sent', 'picked', 'none')),
        reasons text[] not null default '{}',
        created_at timestamptz not null default now()
      );

      -- One row per dater: their QR code and when they arrived and left.
      create table booking_guests (
        booking_id uuid not null references bookings(id) on delete cascade,
        user_id uuid not null references users(id) on delete cascade,
        qr_nonce text not null,
        checked_in_at timestamptz,
        checkin_via text check (checkin_via in ('qr', 'manual')),
        left_at timestamptz,
        late_note int,
        primary key (booking_id, user_id)
      );

      -- Every status change, time-stamped. This is what the staff dashboard shows.
      create table booking_events (
        id bigserial primary key,
        booking_id uuid not null references bookings(id) on delete cascade,
        at timestamptz not null default now(),
        actor_type text not null check (actor_type in ('dater', 'venue', 'system', 'admin')),
        actor_id uuid,
        from_status text,
        to_status text,
        event text not null,
        meta jsonb
      );
      create index booking_events_booking_idx on booking_events(booking_id, at);

      create table notifications (
        id uuid primary key default gen_random_uuid(),
        audience text not null check (audience in ('dater', 'venue', 'admin')),
        user_id uuid references users(id) on delete cascade,
        venue_id text references venues(id) on delete cascade,
        booking_id uuid references bookings(id) on delete cascade,
        event_no int not null,
        code text not null,
        title text not null,
        body text not null,
        channels text[] not null default '{}',
        created_at timestamptz not null default now(),
        read_at timestamptz
      );
      create index notifications_user_idx on notifications(user_id, created_at desc);
      create index notifications_venue_idx on notifications(venue_id, created_at desc);

      create table booking_feedback (
        booking_id uuid not null references bookings(id) on delete cascade,
        user_id uuid not null references users(id) on delete cascade,
        date_rating int not null check (date_rating between 1 and 5),
        date_comment text not null default '',
        venue_rating int not null check (venue_rating between 1 and 5),
        venue_comment text not null default '',
        comment_status text not null default 'pending' check (comment_status in ('pending', 'approved', 'hidden')),
        comment_clean text,
        created_at timestamptz not null default now(),
        primary key (booking_id, user_id)
      );

      create table booking_reports (
        id uuid primary key default gen_random_uuid(),
        booking_id uuid not null references bookings(id) on delete cascade,
        reporter uuid not null references users(id) on delete cascade,
        category text not null,
        details text not null default '',
        status text not null default 'open' check (status in ('open', 'handled')),
        created_at timestamptz not null default now(),
        handled_at timestamptz
      );

      create table redate_requests (
        booking_id uuid not null references bookings(id) on delete cascade,
        user_id uuid not null references users(id) on delete cascade,
        created_at timestamptz not null default now(),
        primary key (booking_id, user_id)
      )
    `,
  },
  {
    id: '0011_test_bookings',
    sql: `
      -- A venue's practice booking before going live: two stand-in guests, never shown to real members.
      alter table bookings add column is_test boolean not null default false;
      alter table venues add column test_users uuid[];
      create index bookings_test_idx on bookings(venue_id) where is_test
    `,
  },
  {
    id: '0012_staff_support',
    sql: `
      -- ChoiceMi's own people: what each may do is decided by their role, in code.
      create table staff (
        user_id uuid primary key references users(id) on delete cascade,
        role text not null check (role in ('super_admin', 'admin', 'support_agent', 'kyc_officer', 'partner_manager', 'moderator', 'auditor')),
        active boolean not null default true,
        created_by uuid references users(id) on delete set null,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );
      insert into staff (user_id, role) select id, 'super_admin' from users where role = 'admin';

      alter table invites drop constraint invites_role_check;
      alter table invites add constraint invites_role_check check (role in ('member', 'partner', 'staff'));
      alter table invites add column staff_role text;

      -- Everything staff change, who did it and when.
      create table audit_log (
        id bigserial primary key,
        at timestamptz not null default now(),
        actor_id uuid references users(id) on delete set null,
        actor_label text not null default '',
        action text not null,
        target_type text,
        target_id text,
        meta jsonb,
        ip text
      );
      create index audit_log_at_idx on audit_log(at desc);
      create index audit_log_target_idx on audit_log(target_type, target_id);

      -- Identity checks that need a person: opened by staff, decided by staff.
      create table kyc_cases (
        id uuid primary key default gen_random_uuid(),
        user_id uuid not null references users(id) on delete cascade,
        status text not null default 'open' check (status in ('open', 'approved', 'rejected', 'revoked')),
        reason text not null default '',
        opened_by uuid references users(id) on delete set null,
        decided_by uuid references users(id) on delete set null,
        decision_note text not null default '',
        created_at timestamptz not null default now(),
        decided_at timestamptz
      );
      create index kyc_cases_user_idx on kyc_cases(user_id);
      create index kyc_cases_status_idx on kyc_cases(status, created_at);

      -- The helpdesk: members and venues write in, staff answer.
      create sequence support_ticket_seq start 10001;
      create table support_tickets (
        id uuid primary key default gen_random_uuid(),
        ref text not null unique,
        requester_id uuid references users(id) on delete set null,
        requester_kind text not null default 'member' check (requester_kind in ('member', 'partner')),
        venue_id text references venues(id) on delete set null,
        booking_id uuid references bookings(id) on delete set null,
        category text not null,
        subject text not null,
        status text not null default 'open' check (status in ('open', 'waiting_customer', 'resolved', 'closed')),
        priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
        assignee_id uuid references users(id) on delete set null,
        source text not null default 'app' check (source in ('app', 'portal', 'report', 'system')),
        first_response_due_at timestamptz not null,
        first_response_at timestamptz,
        resolved_at timestamptz,
        last_activity_at timestamptz not null default now(),
        created_at timestamptz not null default now()
      );
      create index support_tickets_status_idx on support_tickets(status, priority, created_at);
      create index support_tickets_requester_idx on support_tickets(requester_id);
      create index support_tickets_assignee_idx on support_tickets(assignee_id);

      create table support_messages (
        id uuid primary key default gen_random_uuid(),
        ticket_id uuid not null references support_tickets(id) on delete cascade,
        author_id uuid references users(id) on delete set null,
        author_kind text not null check (author_kind in ('requester', 'staff', 'system')),
        internal boolean not null default false,
        body text not null,
        created_at timestamptz not null default now()
      );
      create index support_messages_ticket_idx on support_messages(ticket_id, created_at);

      create table support_events (
        id bigserial primary key,
        ticket_id uuid not null references support_tickets(id) on delete cascade,
        at timestamptz not null default now(),
        actor_id uuid references users(id) on delete set null,
        event text not null,
        meta jsonb
      )
    `,
  },
]
