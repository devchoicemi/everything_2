# ChoiceMi

Anonymous, compatibility-first blind dating. No profile photos. No pre-date chat.
Read the person, pass a read-verification quiz, meet for real. Helsinki pilot,
every member identity-verified.

## Surfaces

| Folder        | Status        | Description                                                     |
| ------------- | ------------- | ------------------------------------------------------------- |
| `web/`        | ✅ in progress | Main user app (Next.js 15, React 19). Splash → verify → onboarding → discover → matches → dates → profile. |
| `restaurant/` | ✅ built       | Restaurant partner site at restaurant.choicemi.com: landing page, a saved-as-you-go application (venue, hours, photos, offer), go-live checks, and a portal for requests, check-in by QR, bookings, ratings and team. Own Next.js app; same API and database as `web/`. See [`restaurant/README.md`](restaurant/README.md). |
| `admin/`      | ✅ built       | ChoiceMi staff site at admin.choicemi.com: helpdesk, venue reviews, booking log, moderation, members, identity checks (KYC), team and roles, activity log and a read-only data browser. What each person sees depends on their staff role. See [`admin/README.md`](admin/README.md). |
| `mobile/`     | 🚧 in progress | PWA / Play Store wrap of `web/` (Capacitor). Android + iOS projects scaffolded; see [`mobile/README.md`](mobile/README.md). |

Design references (three preview HTML builds + PWA package) live outside the repo in
the original hand-off bundle. `web/` follows `choicemi-full.html` exactly.

## Getting started

```bash
cd web
npm install
npm run dev   # http://localhost:3000
```

See [`web/README.md`](web/README.md) for the full route map, stack and backend notes,
and [`mobile/README.md`](mobile/README.md) for the native Android/iOS wrap.
