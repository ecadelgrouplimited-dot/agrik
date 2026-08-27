# Deploying AGRIK to 72.62.185.212

Port **8000** is confirmed free on this box (checked against the full nginx
`proxy_pass` map and every systemd unit's `Environment=PORT=`/`ExecStart=` as
of the 2026-08-23 audit — see `ECADEL_SERVERS_HEALTH_MANAGEMENT`). The API
binds to `127.0.0.1:8000` only; nginx is the sole public entry point, same as
every other project on this host. UFW only allows 22/80/443 in — nothing here
needs a new firewall rule.

Rule from this org's own runbook, followed here too: **secrets are entered by
the operator, never printed, never committed.** This doc names the variables;
you supply the values.

## 1. Database

```bash
sudo -u postgres psql <<'SQL'
CREATE ROLE agrik WITH LOGIN PASSWORD 'CHANGE_ME';
CREATE DATABASE agrik_db OWNER agrik;
SQL
```

## 2. Deploy user + directories

```bash
sudo adduser --system --group --home /var/www/agrik agrik
sudo mkdir -p /var/www/agrik/{web,api,logs}
sudo chown -R agrik:agrik /var/www/agrik
```

## 3. Ship the code

```bash
cd /var/www/agrik
sudo -u agrik git clone git@github-ecadel:ecadelgrouplimited-dot/agrik.git src
sudo -u agrik cp -r src/web/* web/
sudo -u agrik cp -r src/api/* api/
```

(Or `rsync` a built copy from CI — either way, `web/` ends up holding the
built frontend and `api/` the backend source.)

## 4. Backend: install, configure, migrate

```bash
cd /var/www/agrik/api
sudo -u agrik npm ci
sudo -u agrik cp .env.example .env
sudo -u agrik chmod 600 .env
```

Fill in `/var/www/agrik/api/.env` — variable names are in `.env.example`,
values are yours:

```
DATABASE_URL=postgresql://agrik:CHANGE_ME@localhost:5432/agrik_db
JWT_SECRET=            # generate fresh: openssl rand -hex 32
ADMIN_JWT_SECRET=       # generate fresh, different from JWT_SECRET
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=alerts@agrik.co
SMTP_PASS=              # the mailbox password
MAIL_FROM="AGRIK <alerts@agrik.co>"
DEEPSEEK_API_KEY=
OPENAI_API_KEY=
CORS_ORIGIN=https://agrik.co,https://www.agrik.co
PUBLIC_UPLOAD_BASE_URL=https://api.agrik.co/uploads
```

Then:

```bash
sudo -u agrik npx prisma migrate deploy
sudo -u agrik npm run build
# One-time: seed reference districts (+ optionally a first admin)
SEED_ADMIN_EMAIL=you@agrik.co SEED_ADMIN_PASSWORD='CHANGE_ME' \
  sudo -u agrik -E npx tsx prisma/seed.ts
```

## 5. Frontend build

Build with the production API URL baked in (Vite inlines `VITE_*` vars at
build time — do this step wherever you build, then ship `web/dist/`):

```bash
cd web
VITE_API_BASE_URL=https://api.agrik.co npm ci && npm run build
```

## 6. systemd + nginx

```bash
mkdir -p /var/www/agrik/api/uploads && chown agrik:agrik /var/www/agrik/api/uploads

sudo cp deploy/agrik-api.service /etc/systemd/system/agrik-api.service
sudo systemctl daemon-reload
sudo systemctl enable --now agrik-api
curl -s http://127.0.0.1:8000/health   # sanity check before wiring nginx
```

`deploy/agrik.nginx.conf` in this repo is the **post-certbot** reference copy
— it already has `listen 443 ssl` and cert paths that don't exist yet on a
fresh box, so installing it as-is first will fail `nginx -t`. Bootstrap
without the SSL lines, let certbot fill them in, matching how this was
actually done on 72.62.185.212:

```bash
# Strip everything from "listen 443 ssl" through the ssl_dhparam line in each
# server block, and drop the two standalone http->https redirect blocks —
# certbot adds its own. Install what's left as a plain port-80 config:
sudo cp <your-stripped-copy> /etc/nginx/sites-available/agrik.co.conf
sudo ln -s /etc/nginx/sites-available/agrik.co.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
curl -s http://agrik.co/ -o /dev/null -w '%{http_code}\n'        # expect 200
curl -s http://api.agrik.co/health                                # expect {"status":"ok"}

sudo certbot --nginx -d agrik.co -d www.agrik.co -d api.agrik.co --redirect
```

Certbot rewrites `/etc/nginx/sites-enabled/agrik.co.conf` in place, adding the
SSL directives and its own redirect blocks — the result should match
`deploy/agrik.nginx.conf` in this repo.

**Permissions gotcha hit during deploy**: `adduser --system --group --home`
creates the home directory as `750`, which blocks nginx's `www-data` from
even traversing into it to serve static files (`stat() ... Permission
denied` in `/var/log/nginx/error.log`, manifesting as a 500, not a 403). Fix:
`chmod 755 /var/www/agrik` — the `.env` file underneath stays `600` since
nginx never touches it directly (only the `agrik`-user Node process does).

## 7. Verify

```bash
curl -s https://api.agrik.co/health
curl -s https://agrik.co | head -20
sudo systemctl status agrik-api
sudo tail -f /var/www/agrik/logs/api.log
```

## Notes

- **DeepSeek vision model**: chat text uses `deepseek-v4-pro`; vision analysis
  uses the separate `deepseek-v4-flash-vision-exp` model — DeepSeek's vision
  capability isn't on the `-pro` model as of this writing. Confirm this is
  still current before going live; DeepSeek's lineup moves fast.
- **Parish data**: districts are seeded with real names and, for major towns,
  real coordinates. Parish-level data is intentionally **not** seeded — Uganda
  has thousands of parishes and fabricating that list would put fake geography
  in front of real farmers. Import an authoritative UBOS parish dataset via
  `prisma/seed.ts` (extend `seedDistricts`-style) before relying on the
  parish endpoints for anything beyond free-text entry.
- **SMS**: `sms_opt_in` is stored as a user preference but no SMS gateway is
  wired up yet — only email notifications ship in this pass, per your request.
  Wiring an SMS provider (e.g. Africa's Talking) is a follow-up.
- Resource caps in `agrik-api.service` (`CPUQuota=50%`, `MemoryMax=350M`) are
  deliberately conservative given this box's documented chronic load across
  ~20 other tenants. Raise them once real traffic justifies it.
