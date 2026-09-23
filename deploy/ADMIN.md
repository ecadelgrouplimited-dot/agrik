# AGRIK admin console

The admin console is a separate surface from the farmer app: separate route
prefix, separate account table, separate JWT secret, separate token in browser
storage. A farmer account can never reach it, and an admin token is rejected by
the farmer endpoints.

Deployment lives in [DEPLOY.md](DEPLOY.md); this document covers getting into
the console and what you can do once you are in.

## Reaching it

| | |
|---|---|
| Console | `https://agrik.co/admin` |
| Sign-in | `https://agrik.co/admin/login` |
| API prefix | `https://api.agrik.co/admin` |
| Session length | 12 hours (`ADMIN_JWT_EXPIRES_IN`) |
| Browser storage key | `agrik_admin_token` |

There is no link to `/admin` from the farmer app. Navigate to it directly.

## Signing in

Sign-in is two steps, and **both** must succeed:

1. **Email + password** → the API verifies the password, then emails a 6-digit
   code to that admin address. Nothing is returned that would let you in yet.
2. **The code** → exchanged for the 12-hour session token.

The code expires after 10 minutes. "Send a new code" issues a fresh one;
whichever code was sent most recently is the one that works.

### This means SMTP is a hard dependency

An admin cannot sign in if the mail server is misconfigured — there is no
bypass, no break-glass password, no local-only mode. `SMTP_HOST`, `SMTP_USER`
and `SMTP_PASS` are required at boot (the API refuses to start without them),
but a wrong *value* only shows up at sign-in time. If mail fails, the console
says so plainly rather than leaving you waiting for a code that is not coming.

Check mail health before you need it:

```bash
sudo journalctl -u agrik-api -n 50 | grep -i "admin OTP"
```

### Lockouts

Guessing is capped per email-and-IP pair:

| | Attempts | Window | Lockout |
|---|---|---|---|
| Password | 5 | 15 min | 15 min |
| One-time code | 5 | 10 min | 10 min |

A correct password does **not** clear an active lockout — wait it out. The
counters live in the API process's memory, so restarting `agrik-api` clears
every lockout immediately. That is the emergency release if you lock yourself
out of a live incident:

```bash
sudo systemctl restart agrik-api
```

## Creating and resetting admins

There is no sign-up, no invite flow, and **no password change inside the
console** — an admin cannot rotate their own credentials from `/admin`. Admins
are created, and passwords rotated, on the server with the seed script:

```bash
cd /var/www/agrik/api
SEED_ADMIN_EMAIL=ops@agrik.co SEED_ADMIN_PASSWORD='CHANGE_ME' \
  sudo -u agrik -E npx tsx prisma/seed.ts
```

- The email is lowercased before it is stored, because sign-in lowercases it
  before looking it up. `Ops@Agrik.co` and `ops@agrik.co` are the same account.
- Running it again for an **existing** email **resets that admin's password**
  and re-activates the account. This is the only way to change a console
  password, whether it was forgotten or is simply being rotated.
- The script also seeds reference districts, which is idempotent.

To disable an admin without deleting them, set their status away from
`active` — sign-in then refuses with "This admin account is not active":

```sql
UPDATE admins SET status = 'disabled' WHERE email = 'someone@agrik.co';
```

## What is in the console

| Section | Path | What it is for |
|---|---|---|
| Overview | `/admin` | Queue counts, KPIs, moderation readiness, district pressure. Every queue card is a link into the filtered page that resolves it. |
| Users | `/admin/users` | Account directory. Filter by role, status, verification, district, onboarding stage and activity; select a row to edit its role, status and verification, or use the bulk bar for several at once. |
| Listings | `/admin/listings` | Marketplace moderation. Triage weak records, apply bulk actions, inspect a listing without losing the queue. |
| Prices | `/admin/prices` | Publish and correct market prices. The history table shows source and freshness; records older than 5 days are flagged stale. |
| Alerts | `/admin/alerts` | Compose weather and price alerts against a role group, a single recipient or a manual selection. Existing alerts can be paused, edited or deleted. |
| Services | `/admin/services` | Internal AGRIK subscription services — distinct from the marketplace service listings farmers post. |
| Activity | `/admin/activity` | The audit log. |

### Account vocabulary

Two fields are easy to confuse:

- `status` — `active` (what signup writes), plus `pending` and `locked`, which
  only an admin sets. Controls whether the account can be used.
- `verification_status` — `pending` or `verified`. Set to `verified` when the
  user confirms their email, or by an admin. Unverified accounts cannot sign in
  to the farmer app.

`pending` is the value the system writes for an unconfirmed account. Do not
introduce a third spelling for it; the console filters and the signup flow both
key off this exact value.

## Audit log

Every mutating admin action writes a row to `admin_activity` with the admin id,
the action, a JSON detail blob and the request IP. Sign-in events are recorded
too:

| Action | Written when |
|---|---|
| `admin_login_code_sent` | Password accepted, code emailed |
| `admin_signed_in` | Code accepted, session issued |
| `admin_login_failed` | Wrong password, or wrong code (`details.reason`) |
| `user_updated`, `listing_updated`, `price_created`, `price_updated`, `alert_created`, `alert_bulk_created`, `alert_updated`, `alert_deleted`, `service_created`, `service_updated`, `service_deleted`, `services_seeded` | The corresponding change |

The log is append-only from the application's side — nothing in the console
edits or deletes it. An audit write failing never blocks the action it was
recording.

Read it in the console at `/admin/activity`, or directly:

```sql
SELECT created_at, action, details, ip_address
FROM admin_activity ORDER BY created_at DESC LIMIT 50;
```

## Environment variables the console depends on

Beyond what the API needs generally:

| Variable | Required | Notes |
|---|---|---|
| `ADMIN_JWT_SECRET` | yes | Must differ from `JWT_SECRET`. Changing it signs every admin out. |
| `ADMIN_JWT_EXPIRES_IN` | no | Default `12h`. |
| `SMTP_HOST` / `SMTP_USER` / `SMTP_PASS` | yes | No mail, no sign-in. |
| `SMTP_PORT` / `SMTP_SECURE` | no | Default `465` / `true`. |
| `MAIL_FROM` | no | Default `AGRIK <alerts@agrik.co>`. |
| `CORS_ORIGIN` | yes | Must include the origin the console is served from, or every request fails in the browser while working fine from curl. |

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| "Could not send your sign-in code" | SMTP rejected the message | Check `SMTP_*` values and `journalctl -u agrik-api` |
| Code never arrives, no error shown | Delivered but filtered | Check the spam folder; confirm `MAIL_FROM` is a domain the SMTP user may send as |
| "Too many sign-in attempts" with the right password | Lockout is active | Wait it out, or `systemctl restart agrik-api` |
| "Code expired. Sign in again to get a new one." | Older than 10 minutes, or already used | Use "Send a new code" |
| Signed out after ~12 hours | Token expired, as designed | Sign in again |
| Console loads but every panel is empty | Token rejected, or CORS | Check `ADMIN_JWT_SECRET` has not changed and `CORS_ORIGIN` includes this origin |
| Signed in but immediately bounced to `/admin/login` | `GET /admin/me` is failing | Check the API is up and reachable from the browser's origin |

## Local development

The console needs a database, an admin account and a mail path. A throwaway
Postgres and the seed script cover the first two:

```bash
cd api
cp .env.example .env     # then point DATABASE_URL at a local database
npx prisma migrate deploy
SEED_ADMIN_EMAIL=admin@agrik.local SEED_ADMIN_PASSWORD='devpassword123' npm run seed
npm run dev
```

```bash
cd web
VITE_API_BASE_URL=http://localhost:8000 npm run dev
```

For the code, point `SMTP_HOST`/`SMTP_PORT` at any local SMTP catcher
(MailHog, Mailpit, or similar) and read it from there. The API deliberately has
no "log the code in development" path — a flag like that is one misconfigured
`NODE_ENV` away from printing live sign-in codes into production logs.
