# MyDentist — Marketing Site

Public-facing landing page for MyDentist. React + Vite static site, "Clinical Calm"
design (Fraunces + Outfit, teal/mint/bone palette).

## Develop
```bash
npm install
npm run dev      # http://localhost:5174
```

## Environment
`.env`:
```
VITE_APP_URL=<url of the deployed patient/doctor web app>
```
The "Get the App / Log in / Book" buttons link to `VITE_APP_URL`.

## Deploy (Vercel)
Import the repo as a new Vercel project:
- **Root Directory:** `Marketing Site`
- **Env var:** `VITE_APP_URL` = your deployed Patient Frontend web URL
- Vercel uses `vercel.json` (build → `dist/`, SPA rewrites).

This is a separate Vercel project from the backend, the app, and the admin panel —
all four share the same backend API.
