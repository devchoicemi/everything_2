# ChoiceMi for Restaurants

The restaurant partner site: a landing page for venues, and a portal where a venue's team sets its
opening times, sees the couples booked, checks guests in and claims the offer. It lives at
**https://restaurant.choicemi.com** and is a separate app from the member app in `../web`.

It has **no backend of its own**. It calls the same ChoiceMi API (`/api/v1/...`, in `../web/app/api`) and the
same Postgres database. The API side of the portal is in `../web/lib/server/partner/` and
`../web/app/api/v1/partner/`; the admin side (approving restaurants) is `../web/app/api/v1/admin/partners/`.

## What is in it

| Page | Who | What it does |
| --- | --- | --- |
| `/` | everyone | Landing page: what ChoiceMi for restaurants is, how it works, FAQ |
| `/apply` | everyone | Start an application: create the account (name, email, password). Everything after is saved as you go |
| `/onboarding` … `/onboarding/offer` | applicant | Four steps: venue, Business ID (Y-tunnus, checked against YTJ) and map location picked from search; opening hours per weekday, exception dates, start times and dates per slot; four photos checked against the photo brief; offer, accessibility, price, terms. Contact email is confirmed by link and the booking phone by an SMS code |
| `/onboarding/status` | applicant | In review, sent back with reasons per item, or approved |
| `/onboarding/go-live` | approved venue | Set up the check-in device, brief staff, run a test booking (two test QR codes), then **Go live** |
| `/join?invite=` | invited colleagues | Create a sign-in from the emailed invitation |
| `/login`, `/forgot-password`, `/reset-password`, `/verify-email` | partners | Sign in (password, then a code emailed to them), reset a password, confirm an email |
| `/dashboard` | venue team | Today's dates, requests that need an answer, "has this date ended?" prompts |
| `/requests` | venue team | Confirm or decline a booking request (alerts also arrive by email and SMS) |
| `/bookings`, `/bookings/[id]` | venue team | A week at a time; end a date, mark a no-show, cancel (owner) |
| `/checkin` | the host-stand device | Camera QR scan; fallback username **and** 4-digit code; shows first guest and started states |
| `/availability` | owner edits, staff view | Hours, exception dates, start times, dates per slot |
| `/venue` | owner edits | Offer, accessibility, price, contact; pause or resume |
| `/team` | owner invites and removes | Colleagues and how to set up a check-in device |
| `/ratings` | venue team | Dates hosted, no-shows, offers given, ratings (average only after 5), checked comments |
| `/alerts`, `/help` | venue team | The portal inbox; write to ChoiceMi support |

Guests appear only as two usernames and a booking reference. The venue never sees a photo, email, phone number or
the 4-digit booking code: staff type in what the guest tells them, and a username alone never checks anyone in.

## How a venue joins

1. They start an application on `/apply` (or ChoiceMi sets up a venue it agreed with: `./partners.sh add`).
2. They complete the four steps and send it. ChoiceMi staff review it at admin.choicemi.com (Venues) and either send it
   back with reasons or approve it.
3. After approval: check-in device, staff briefing, a test booking. Then **Go live**: members can book it.
4. The owner invites colleagues from `/team` (staff can answer requests and check guests in; only owners change settings).

## Running it on your computer

```bash
# 1. the ChoiceMi backend, in ../web (http://localhost:3000). It needs these to talk to this site:
#    PARTNER_BASE_URL=http://localhost:3200   (links in partner emails point here)
#    ADMIN_TOKEN=<48+ random characters>      (to approve restaurants)
cd ../web && npm install && npm run dev

# 2. this site, in a second terminal (http://localhost:3200). BACKEND_URL makes it forward /api/* to the backend.
cd restaurant && npm install
BACKEND_URL=http://localhost:3000 npm run dev
```

In development emails are printed in the backend's console (look for `[mail:dev]`), including the 6-digit codes
and invitation links.

## Deploying

`deploy/` at the repository root runs both sites. The `restaurant` service is built from `restaurant/Dockerfile`;
Caddy serves `restaurant.choicemi.com`, sending `/api/*` to the backend and everything else here, so sign-in
cookies stay on the restaurant address. DNS needs one record: `A  restaurant  →  the server's IP`. The GitHub
workflow builds both images on every merge to `main`.

## Notes

- Passkeys are not offered here (they are tied to choicemi.com). Partners sign in with password and an emailed code.
- The partner terms are the main Terms and Privacy Policy for now. A separate partner agreement needs a lawyer.
- Brand tokens (violet and the Figtree font) are copied from `../web`; the restaurant site is deliberately warmer
  (paper and ink) so the two sites feel related but not identical.
