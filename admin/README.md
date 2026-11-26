# ChoiceMi staff site

ChoiceMi's own team signs in here: **https://admin.choicemi.com**. It is a separate app from the member app (`../web`) and
the restaurant site (`../restaurant`), with no backend of its own. It calls the same ChoiceMi API (`/api/v1/admin/...`)
and the same database. Sign-in cookies stay on this address.

## Roles

A staff account has one role. Each role holds a fixed list of permissions (`../web/lib/server/staff/access.ts`),
every admin endpoint asks for one, and the menu shows only what the role may open.

| Role | Can |
| --- | --- |
| Super admin | Everything, including inviting staff and changing roles |
| Admin | Everything except managing the team |
| Support agent | Helpdesk (read and reply), look up accounts and bookings |
| KYC officer | Identity checks (read and decide), look up accounts, read tickets |
| Partner manager | Review restaurant applications, bookings, helpdesk |
| Moderator | Comments, concerns and no-shows; bookings; accounts |
| Auditor | Read-only everywhere, including the activity log and the data browser |

Everything staff change is written to the **activity log** (who, what, when, from which address). The last super admin
cannot be demoted or switched off. Switching a person off ends their sessions at once.

## Pages

| Page | Permission | What it does |
| --- | --- | --- |
| `/dashboard` | any | What needs a person now, per role |
| `/support`, `/support/[id]` | `support.read` / `support.reply` | Helpdesk queue with first-reply deadlines, thread, internal notes, assign, priority, status |
| `/venues`, `/venues/[id]` | `venues.review` | Review a restaurant: Business ID and YTJ, map pin, four photos, hours, contact; pass or fail each item; approve or send back with reasons |
| `/bookings`, `/bookings/[id]` | `bookings.read` | Every booking and every status change; stalled ones |
| `/moderation` | `moderation.manage` | Concerns raised by daters, venue comments to check before a venue sees them, low-rated daters |
| `/users`, `/users/[id]` | `users.read` / `users.manage` | Find an account; sections shown by role; suspend, reactivate, sign out everywhere |
| `/kyc` | `kyc.read` / `kyc.decide` | Cases that need a person; members stuck unverified; approve (by staff), reject, revoke, with a note |
| `/team` | `staff.manage` | Invite staff, change roles, switch off; the role matrix |
| `/audit` | `audit.read` | The activity log |
| `/data`, `/data/[table]` | `data.read` | A read-only look at every table; passwords, tokens, codes and keys are hidden; each view is logged |

## First super admin

On the server, in `/opt/choicemi`:

```bash
./staff.sh invite you@choicemi.com super_admin
```

They get an email with a personal link to `/join`. After that, invite everyone else from **Team and roles**.

## Running it on your computer

```bash
npm install
BACKEND_URL=http://localhost:3000 npm run dev   # http://localhost:3300
```

Run the member app (`../web`) on port 3000 first. In production Caddy sends `/api/*` on admin.choicemi.com to the backend.
