# Deploying MyDentist to Namecheap Shared Hosting (cPanel + PostgreSQL)

Target domain: **mydentistpk.com**. No code or schema changes are required — your
hosting has PostgreSQL, so the backend runs unchanged.

## Architecture (recommended: subdomains)

| Piece                         | URL                        | What it is                         |
|-------------------------------|----------------------------|------------------------------------|
| Marketing / landing page      | `mydentistpk.com`          | public static site in `public_html`|
| Patient + doctor web app      | `app.mydentistpk.com`      | Expo web export, static in subdomain docroot |
| Admin Panel (Vite build)      | `admin.mydentistpk.com`    | static files in a subdomain docroot|
| Backend API (Express/Prisma)  | `api.mydentistpk.com`      | cPanel "Setup Node.js App"         |
| Patient mobile               | —                          | release APK, points at the API     |

The **root domain is reserved for marketing** (branding + SEO); the app lives on
`app.` This is the recommended split. You can also collapse everything under one domain
with paths, but subdomains keep CORS/SSL/routing simplest.

---

## 1) Create the PostgreSQL database (cPanel)

cPanel → **PostgreSQL Databases**:
1. Create a database, e.g. `dentist` → real name becomes `cpuser_dentist`.
2. Create a user, e.g. `dbuser` → real name becomes `cpuser_dbuser`; set a strong password.
3. **Add the user to the database** with **ALL PRIVILEGES**.

Your connection string (host is `localhost` because the DB is on the same server):

```
DATABASE_URL="postgresql://cpuser_dbuser:PASSWORD@localhost:5432/cpuser_dentist?schema=public"
```

> If the panel shows a different port than 5432, use that. URL-encode any special
> characters in the password (`@` → `%40`, etc.).

---

## 2) Deploy the backend as a Node.js App

### a. Upload the code
Put the `backend/` folder somewhere **outside** `public_html`, e.g. `~/apps/dentist-api`.
- Easiest: `git clone` your repo on the server (Terminal in cPanel), or
- Zip `backend/` locally (WITHOUT `node_modules`), upload via File Manager, extract.

Do **not** upload `node_modules` — you'll install on the server so Prisma builds the
correct Linux query engine.

### b. Create the app
cPanel → **Setup Node.js App** → **Create Application**:
- **Node.js version:** 18 or 20 (Prisma 6 needs ≥ 18).
- **Application mode:** Production
- **Application root:** `apps/dentist-api`
- **Application URL:** `api.mydentistpk.com`
- **Application startup file:** `server.js`

### c. Environment variables
In the app's **Environment variables** section add (do **NOT** set `PORT` — Passenger
assigns it):
```
NODE_ENV=production
DATABASE_URL=postgresql://cpuser_dbuser:PASSWORD@localhost:5432/cpuser_dentist?schema=public
JWT_SECRET=<long random string>
JWT_EXPIRE=7d
JWT_REFRESH_SECRET=<different long random string>
JWT_REFRESH_EXPIRE=30d
```
(Optional) `CRON_SECRET=<random>` if you'll trigger the scheduled-broadcast cron.

### d. Install + migrate
1. Click **Run NPM Install** (this also runs `postinstall` → `prisma generate`).
2. Open the app's terminal environment. cPanel shows a command like
   `source /home/cpuser/nodevenv/apps/dentist-api/18/bin/activate && cd ~/apps/dentist-api`.
   Run it, then:
   ```bash
   npx prisma migrate deploy      # applies your migrations to the cPanel DB
   ```
3. **Create the first super-admin.** Do NOT run `npm run seed` in production — the seed
   WIPES the DB and inserts demo data. Instead create one admin (see §6).
4. Back in the Node.js App UI, click **Restart**.

Verify: open `https://api.mydentistpk.com/` → you should see the
`🦷 MyDentist API is running` health JSON.

---

## 3) Deploy the Admin Panel (static)

Locally, in `Admin Panel/`:
```bash
# .env (or inline) for the production build:
VITE_API_URL=https://api.mydentistpk.com
VITE_APP_WEB_URL=https://mydentistpk.com
npm run build          # outputs dist/
```
In cPanel:
1. **Domains → Create subdomain** `admin.mydentistpk.com` (note its document root).
2. Upload **the contents of `dist/`** into that document root.
3. Add a `.htaccess` there so client-side routing works:
   ```apache
   <IfModule mod_rewrite.c>
     RewriteEngine On
     RewriteBase /
     RewriteRule ^index\.html$ - [L]
     RewriteCond %{REQUEST_FILENAME} !-f
     RewriteCond %{REQUEST_FILENAME} !-d
     RewriteRule . /index.html [L]
   </IfModule>
   ```

---

## 4) Patient app

### Mobile (the real product)
Rebuild the release APK with the production API baked in. In `Patient Frontend/.env`:
```
EXPO_PUBLIC_API_URL=https://api.mydentistpk.com
```
Then build the APK (EAS or local gradle) and distribute. `EXPO_PUBLIC_*` is baked at
build time, so you must rebuild after changing it.

### Web — served at `https://app.mydentistpk.com`

The same codebase runs on the web (role-routed patient + doctor). It's a **static
export**, deployed exactly like the Admin Panel.

1. In `Patient Frontend/.env` set the production API (baked in at export time):
   ```
   EXPO_PUBLIC_API_URL=https://api.mydentistpk.com
   ```
2. Build the static web bundle:
   ```bash
   cd "Patient Frontend"
   npx expo export -p web        # → outputs dist/
   ```
3. **Domains → Create subdomain** `app.mydentistpk.com`, then upload **the contents of
   `dist/`** into its document root and add the same SPA `.htaccess` shown in §3.
4. **HTTPS is required** (see §5) — browser geolocation (`expo-location`) and the
   camera / file picker (`expo-image-picker`) only work over HTTPS on the web.

**Web caveats** (both degrade gracefully — the app already branches on `Platform.OS`):
- **Map screen:** no native map on web; `MapScreen` uses its web/webview fallback. Give
  it a visual check after deploy.
- **Bluetooth bill printer** is native-only hardware and is disabled on web — doctors who
  print bills should use the mobile app.

---

## 5) Marketing / landing page (root `mydentistpk.com`)

The root domain is your **public front door** — the marketing/landing site people see
before signing in. It is **not** part of this repo; it's separate content you provide.

1. Build or obtain the landing site (any static HTML/CSS, or a builder export). This repo
   doesn't contain one — it's a marketing asset, kept separate from the app code.
2. Upload it to `public_html` (the `mydentistpk.com` root).
3. Link its "Login / Open App" / "Book now" buttons to **`https://app.mydentistpk.com`**
   (the web app), and the app-store / APK download for mobile.

Nothing to build from this codebase for the root — just make sure its call-to-action
points at `app.mydentistpk.com`. If you don't have a landing page yet, a simple
placeholder (logo + tagline + "Open the app" button → `app.mydentistpk.com`) is enough to
launch, and you can flesh it out later.

---

## 6) SSL + HTTPS

cPanel → **SSL/TLS Status** → run **AutoSSL** for `mydentistpk.com`,
`app.mydentistpk.com`, `admin.mydentistpk.com`, `api.mydentistpk.com`. Then force HTTPS
(cPanel Domains toggle, or `.htaccess` redirect). The apps assume `https://` everywhere.

---

## 7) Create the first admin (production-safe)

`npm run seed` wipes everything — don't use it in prod. Instead, from the backend app's
activated terminal, run a one-off Node snippet (adjust email/password):

```bash
node -e '
const prisma = require("./config/prisma");
const bcrypt = require("bcryptjs");
(async () => {
  const email = "admin@mydentistpk.com";
  const password = await bcrypt.hash("CHANGE_ME_STRONG", 10);
  const user = await prisma.user.create({ data: { email, password, role: "admin" } });
  await prisma.adminProfile.create({
    data: { userId: user.id, fullName: "Super Admin", adminRole: "super_admin" }
  });
  console.log("Admin created:", email);
  process.exit(0);
})();
'
```
> Uses `bcryptjs` (the package this repo installs) and `adminRole: "super_admin"` (how
> the code identifies a super admin). `permissions` has a sensible default in the schema,
> so it's omitted here.

Then log in at `https://admin.mydentistpk.com`. Configure **SMTP** under
Admin → Settings → Email so password-reset emails send from your domain mailbox.

---

## 8) Post-deploy checklist

- [ ] `GET https://api.mydentistpk.com/` returns the health JSON.
- [ ] Admin login works; dashboard loads (confirms DB + JWT).
- [ ] Create a test doctor/patient; upload an image → confirm it persists under
      `/uploads` after an app restart (cPanel disk is persistent, unlike Vercel).
- [ ] APK/web patient app can register + log in against the production API.
- [ ] SMTP test email sends (Admin → Settings → Email → Send test).
- [ ] Lock down CORS later if desired (see notes).

---

## Real-world gotchas hit on this host (mydentistpk.com / Namecheap Stellar)

This host is **LiteSpeed `lsnode`** (not Phusion Passenger) on a **Debian-based** box.
Lessons from the first deploy:

- **Prisma engine target = `debian-openssl-1.0.x`.** The live LiteSpeed app runtime
  detects **OpenSSL 1.0.x**, even though the SSH shell reports 1.1.x. If the client is
  generated only for 1.1.x, manual `node` runs work but the live app 500s with
  *"could not locate the Query Engine for runtime debian-openssl-1.0.x"*. The schema's
  `binaryTargets` therefore includes `debian-openssl-1.0.x` (+1.1.x/3.0.x as safety nets).
- **`prisma generate` DOES run on the server** (it did NOT OOM in the end) — so after
  uploading code you can just `npx prisma generate` over SSH. The client is generated into
  `generated/prisma` (custom `output`), which `config/prisma.js` imports.
- **Restart = kill the process.** `touch tmp/restart.txt` (a Passenger convention) does
  NOT reliably restart lsnode. Use `pkill -u $(whoami) -f lsnode` then hit the URL to
  respawn, or the cPanel **Restart** button.
- **"Cannot acquire lock" (app won't stop / npm install fails):** a hung process left the
  Node.js Selector lock held. Over SSH: `pkill -u $(whoami) -f 'npm|prisma|node'` and
  remove stale `*.lock` files under `~/nodevenv`.
- **Migrations without the Prisma CLI:** `scripts/applyMigrations.js` applies each
  `migration.sql` using only the query engine (advisory-locked, idempotent) — used by
  `bootstrap.js`. Handy when the migrate CLI misbehaves.
- **`.env` vs cPanel UI env vars:** the app reads `.env` via dotenv, but any var ALSO set
  in the cPanel Node.js App UI is injected by the runtime and dotenv will NOT override it.
  Keep them consistent (or set vars in only one place) to avoid the live app using a
  different `DATABASE_URL` than your manual `node` runs.
- **Reset the admin password** (ensureAdmin only *creates*, never updates):
  `node -e '…bcrypt.hash…prisma.user.update…' 'newpass'` (see chat history).

## Notes / gotchas

- **Passenger & PORT:** never hardcode a port in production; the app already uses
  `process.env.PORT`. Passenger provides it.
- **No websockets:** chat/notifications use polling, which works fine on shared hosting.
- **Uploads persist** on cPanel disk (`backend/uploads/`, served at `/uploads`) — no S3
  needed here (that was only a Vercel/serverless limitation).
- **Migrations:** always use `npx prisma migrate deploy` in production (never
  `migrate dev`, which can create/reset).
- **CORS:** currently open (`app.use(cors())`). To restrict, change `server.js` to
  `cors({ origin: ["https://mydentistpk.com","https://admin.mydentistpk.com"], credentials: true })`
  and redeploy.
- **App restarts:** after changing env vars or code, hit **Restart** in the Node.js App
  UI (or `touch tmp/restart.txt` in the app root).
- **Node version pin (optional):** add `"engines": { "node": ">=18" }` to
  `backend/package.json` so the platform picks a compatible runtime.
