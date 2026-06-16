# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

This is a monorepo with three top-level folders (no root package.json — each is installed and run independently):

- **`Combined Backend/`** — Node.js + Express REST API + Mongoose/MongoDB. Serves **both** patient and doctor roles.
- **`Patient Frontend/`** — The real app. A single React Native (Expo SDK 54) codebase containing **both** the patient flow and the doctor dashboard. Role is resolved at runtime from the JWT.
- **`Doctor Frontend/`** — A standalone Expo scaffold for a future independent doctor app. **Not connected to the backend.** Ignore it unless explicitly asked.

> Note: `AGENTS.md` in both frontend folders says "Expo v56 — read https://docs.expo.dev/versions/v56.0.0/". The actual installed version is **Expo SDK 54 / React Native 0.81** (see `package.json`). Trust `package.json`.

## Commands

### Backend (`Combined Backend/`)
```bash
npm install
npm run dev      # nodemon, auto-restart — use during development
npm start        # node server.js — listens on 0.0.0.0:5000
npm run seed     # seed demo doctors/clinics/treatments/reviews via utils/seedData.js
```
There is **no test runner or linter configured.** The `test_*.js` / `check_*.js` / `seed_*.js` / `fix*.js` files at the backend root are ad-hoc standalone scripts run directly with `node <file>.js` against the live DB — they are not a test suite. `generateCollection.js` / `generatePatientCollection.js` regenerate the Postman collection.

### Frontend (`Patient Frontend/`)
```bash
npm install
npm start        # expo start (Metro bundler)
npm run android  # / npm run ios / npm run web
npx expo start --clear   # clear Metro cache if the app misbehaves after edits
```
No tests or lint here either.

## Environment

- Backend reads `Combined Backend/.env`: `PORT`, `MONGODB_URI`, `JWT_SECRET`, `JWT_EXPIRE`, `JWT_REFRESH_SECRET`, `JWT_REFRESH_EXPIRE`, `NODE_ENV`.
- Frontend reads `Patient Frontend/.env`: `EXPO_PUBLIC_API_URL`. The `EXPO_PUBLIC_` prefix is mandatory — Expo only injects prefixed vars into the bundle. If unset, `src/config/api.js` falls back to `http://10.0.2.2:5000` (Android emulator) or `http://localhost:5000` (iOS/web).
- The server serves uploaded files from `Combined Backend/uploads/` at `/uploads`. This folder must exist or image uploads fail.

## Architecture

### Backend — strict controller/route/model layering
Standard MVC-ish split, **one file per resource** across parallel folders: `routes/<x>.routes.js` → `controllers/<x>.controller.js` → `models/<X>.js`. `server.js` mounts every router under `/api/<x>`. To add an endpoint, touch the route + controller (+ model if new data).

- **Auth**: `middleware/auth.js` exports `protect` — pulls the Bearer token, verifies with `JWT_SECRET`, and attaches `req.user` (password stripped). `middleware/roleCheck.js` exports `authorize('doctor', 'patient', ...)` — checks `req.user.role` against an allowlist. Routes compose them: `router.post('/', protect, authorize('doctor'), handler)`.
- **Tokens**: `utils/generateToken.js` issues an access + refresh token pair. The refresh token is also persisted on the `User` document (`refreshToken` field, `select: false`).
- **Data model**: A `User` holds only auth identity (`email`, hashed `password`, `role` ∈ `doctor|patient|vendor`). Role-specific data lives in a **separate profile document** — `PatientProfile` or `DoctorProfile` — linked by `userId`. On registration, `auth.controller.register` creates the matching profile with a placeholder name (`"New Patient"` / `"New Doctor"`); this placeholder is the signal for "onboarding not yet complete" (see role routing below).
- **Password hashing**: handled by a `pre('save')` hook on the `User` schema; compare via `user.matchPassword(plain)`. Password field is `select: false` — query with `.select('+password')` when you need it.
- **Response convention**: every endpoint returns `{ success: boolean, message?, data? }`. Errors flow through `middleware/errorHandler.js`. Preserve this shape — the frontend depends on `res.data.success` and `res.data.data`.

### Frontend — runtime role routing, no central API client
- **Single flat stack navigator** (`src/navigation/AppNavigator.js`): all screens are siblings in one `Stack.Navigator`. There are two `BottomTabNavigator`s registered as stack screens — `MainTabs` (patient) and `DoctorTabs` (doctor). The app does **not** swap navigators based on auth state.
- **Role + onboarding routing happens in `SplashScreen.js`**, not in the navigator. On launch it reads the `userToken` from storage, calls `GET /api/users/me`, then `navigation.replace`s to: `DoctorTabs` / `MainTabs` if onboarded, or `DoctorRegister` / `PatientSetup` if the profile `fullName` is still the `"New Doctor"`/`"New Patient"` placeholder. No token → `RoleSelection`.
- **Token storage**: `src/config/storage.js` is a platform wrapper — `expo-secure-store` on device, `localStorage` on web. The token is stored under the key **`userToken`**. Always go through this wrapper, never SecureStore directly.
- **API calls are made ad-hoc per screen**: there is **no shared axios instance and no interceptor.** Each screen imports `axios` + `API_BASE_URL from '../config/api'` and manually attaches `headers: { Authorization: \`Bearer ${token}\` }` after reading the token from storage. When adding a screen, follow this same pattern. File uploads use `fetch` with `FormData` (not axios).
- **Image URLs**: profile/gallery images may be relative (`/uploads/...`) or already absolute (`http`, `file:`, `content:`). Screens prefix relative paths with `API_BASE_URL` — see `ProfileScreen.js` for the canonical check.
- **`NotificationContext`** (`src/context/NotificationContext.js`) provides a global unread/chat badge that polls every ~5s; it drives the `tabBarBadge` on the Inbox tabs.

### Doctor screens
Patient screens are in `src/screens/`; doctor screens are in `src/screens/doctor/`, and the doctor profile detail view is split into tab components under `src/screens/doctor/tabs/` (About, Treatments, Gallery, Reviews, Appointments, Bills, Rewards).

## Conventions to preserve
- Keep the `{ success, message, data }` envelope on every backend response.
- Keep auth as `protect` + `authorize(...)` middleware composition on routes.
- Keep the `User` (identity) vs `Profile` (role data) separation; don't add role-specific fields to `User`.
- On the frontend, keep the per-screen `axios` + manual Bearer header pattern and the `storage` wrapper — don't introduce a global client unless asked.
