# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

This is a monorepo with several top-level folders (no root package.json — each is installed and run independently):

- **`backend/`** — Node.js + Express REST API on **PostgreSQL via Prisma**. Serves **both** patient and doctor roles, plus the admin panel.
- **`Patient Frontend/`** — The real app. A single React Native (Expo SDK 54) codebase containing **both** the patient flow and the doctor dashboard. Role is resolved at runtime from the JWT.
- **`Admin Panel/`** — React + Vite admin dashboard (talks to `/api/admin/*`).
- **`Doctor Frontend/`** — A standalone Expo scaffold for a future independent doctor app. **Not connected to the backend.** Ignore it unless explicitly asked.

> The backend was migrated from MongoDB/Mongoose to PostgreSQL/Prisma. Old Mongoose models/scripts have been removed. If you see references to Mongoose/MongoDB anywhere, they're stale.
> Note: `AGENTS.md` in the frontend folders says "Expo v56". The actual installed version is **Expo SDK 54 / React Native 0.81** (see `package.json`). Trust `package.json`.

## Commands

### Backend (`backend/`)
```bash
npm install
npm run dev               # nodemon, auto-restart — use during development
npm start                 # node server.js — listens on 0.0.0.0:5000
npm run seed              # reset + seed demo data via prisma/seed.js (WIPES the DB first)

npx prisma migrate dev    # create/apply a migration after editing prisma/schema.prisma
npx prisma generate       # regenerate the client after schema changes
npx prisma studio         # browse the DB in a GUI
```
There is **no test runner or linter configured.** `generateCollection.js` / `generatePatientCollection.js` regenerate the Postman collection. `test_email.js` verifies SMTP (`node test_email.js you@x.com`).

### Frontend (`Patient Frontend/`)
```bash
npm install
npm start        # expo start (Metro bundler)
npm run android  # / npm run ios / npm run web
npx expo start --clear   # clear Metro cache if the app misbehaves after edits
```

### Admin Panel (`Admin Panel/`)
```bash
npm install
npm run dev      # vite dev server
npm run build    # production build
```
No tests or lint in any of these.

## Environment

- Backend reads `backend/.env`: `PORT`, `DATABASE_URL` (Postgres connection string), `JWT_SECRET`, `JWT_EXPIRE`, `JWT_REFRESH_SECRET`, `JWT_REFRESH_EXPIRE`, `NODE_ENV`.
- **SMTP / email config is NOT in `.env`** — it's admin-managed, stored in `AppSettings.smtp` and edited from Admin Panel → Settings → Email (SMTP). The mailer (`utils/mailer.js`) reads the DB first, then falls back to `SMTP_*` env vars if present.
- Frontend reads `Patient Frontend/.env`: `EXPO_PUBLIC_API_URL`. The `EXPO_PUBLIC_` prefix is mandatory. If unset, `src/config/api.js` falls back to `http://10.0.2.2:5000` (Android emulator) or `http://localhost:5000` (iOS/web).
- Admin Panel reads `VITE_API_URL` (API base) and `VITE_APP_WEB_URL` (used by "View as" impersonation).
- **Uploads** are stored on local disk (`backend/uploads/`, served at `/uploads`) via `config/upload.js` (`saveUpload` + multer `memoryUpload`). Returns relative `/uploads/...` URLs. On ephemeral/serverless hosts the filesystem is wiped between requests — use a volume or object store there.

## Architecture

### Backend — route → controller → Prisma
Standard split, **one file per resource**: `routes/<x>.routes.js` → `controllers/<x>.controller.js`, all data access through the shared Prisma client. `server.js` mounts every router under `/api/<x>` and requires `./config/prisma` (the client connects lazily). To add an endpoint, touch the route + controller (+ `prisma/schema.prisma` + a migration if new data).

- **Prisma**: schema in `prisma/schema.prisma`; the shared client is `config/prisma.js` (a global singleton). IDs are string **cuid**s. Nested Mongo-style subdocuments/arrays are `Json` (JSONB) columns; scalar arrays are Postgres `String[]`.
- **API-shape compatibility (`utils/serialize.js`)**: the frontend still expects Mongo conventions, so responses go through `serialize()` (adds `_id` mirroring `id`, deep) and `remapRefs()`/`remapMany()` (moves an included relation object onto its Mongo FK name, e.g. Prisma `{ patient }` → `patientId: <object>`, reproducing `populate`). **Always pass list/detail responses through these** so the apps keep working without changes.
- **Auth**: `middleware/auth.js` exports `protect` — verifies the Bearer token with `JWT_SECRET`, loads the user via Prisma (omitting `password`/`refreshToken`), and attaches `req.user` with both `id` and `_id`. `middleware/roleCheck.js` exports `authorize('doctor', 'patient', ...)`. Compose them: `router.post('/', protect, authorize('doctor'), handler)`.
- **Tokens**: `utils/generateToken.js` issues an access + refresh pair (DB-agnostic). The refresh token is persisted on the `User` row.
- **Password hashing**: done explicitly with bcrypt in the auth/admin controllers (there is **no** pre-save hook now — Prisma has none). Hash on create/reset; `bcrypt.compare` on login.
- **Data model**: a `User` row holds only auth identity (`email`, hashed `password`, `role` ∈ `doctor|patient|vendor|admin`). Role data lives in a separate **profile** table — `PatientProfile` / `DoctorProfile` / `AdminProfile` — linked by `userId`. Registration creates the profile with a placeholder name (`"New Patient"` / `"New Doctor"`), the signal for "onboarding not complete" (see role routing).
- **Money/commission & referrals**: `utils/commission.js` (idempotent, atomic per-bill accrual via optimistic compare-and-set + `increment`), `utils/popular.js` (reward points → popular badge), `utils/referral.js` (referral bonuses). Bills auto-accrue platform commission on payment.
- **Geo**: nearby-doctors uses a **haversine raw SQL** query on `DoctorProfile.lat`/`lng` (no PostGIS dependency).
- **Response convention**: every endpoint returns `{ success: boolean, message?, data? }`. Errors flow through `middleware/errorHandler.js`. Preserve this shape — the frontend depends on `res.data.success` and `res.data.data`.

### Frontend — runtime role routing, no central API client
- **Single flat stack navigator** (`src/navigation/AppNavigator.js`): all screens are siblings; two `BottomTabNavigator`s (`MainTabs` patient / `DoctorTabs` doctor) are registered as stack screens. The app does **not** swap navigators based on auth state.
- **Role + onboarding routing happens in `SplashScreen.js`**: it reads `userToken`, calls `GET /api/users/me`, then `navigation.replace`s to `DoctorTabs`/`MainTabs` if onboarded, or `DoctorRegister`/`PatientSetup` if the profile `fullName` is still the placeholder. No token → `RoleSelection`.
- **Token storage**: `src/config/storage.js` wraps `expo-secure-store` (device) / `localStorage` (web) under the key **`userToken`**. Always go through this wrapper.
- **API calls are ad-hoc per screen**: no shared axios instance/interceptor. Each screen imports `axios` + `API_BASE_URL from '../config/api'` and attaches `headers: { Authorization: \`Bearer ${token}\` }`. File uploads use `fetch` + `FormData`.
- **Image URLs**: may be relative (`/uploads/...`) or absolute (`http`, `file:`, `content:`). Resolve with `config/imgUrl.js` (prefixes relative paths with `API_BASE_URL`).
- **`NotificationContext`** polls unread/chat counts (~5s) and drives the Inbox tab badge.

### Doctor screens
Patient screens are in `src/screens/`; doctor screens in `src/screens/doctor/`, with the doctor profile detail split into tabs under `src/screens/doctor/tabs/` (About, Treatments, Gallery, Facilities, Reviews, Appointments, Bills, Rewards).

## Conventions to preserve
- Keep the `{ success, message, data }` envelope on every backend response.
- **Run list/detail responses through `serialize`/`remapRefs`** so the API keeps its `_id` + populated-ref shape (the apps depend on it).
- Keep auth as `protect` + `authorize(...)` middleware composition on routes.
- Keep the `User` (identity) vs `Profile` (role data) separation; don't add role-specific fields to `User`.
- After editing `prisma/schema.prisma`, run `npx prisma migrate dev` (+ `generate`).
- On the frontend, keep the per-screen `axios` + manual Bearer header pattern and the `storage` wrapper — don't introduce a global client unless asked.
