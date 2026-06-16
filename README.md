# MyDentist — Dental Clinic & Patient Management Platform

A full-stack mobile application that connects dental clinics and patients through a single, role-aware React Native app backed by a Node.js REST API and MongoDB.

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Tech Stack](#tech-stack)
4. [Project Structure](#project-structure)
5. [Features](#features)
6. [API Reference](#api-reference)
7. [Environment Variables](#environment-variables)
8. [How to Run](#how-to-run)
9. [Database Seeding](#database-seeding)
10. [Postman Testing](#postman-testing)
11. [Troubleshooting](#troubleshooting)

---

## Overview

MyDentist is a production-ready mobile platform with two user roles — **Patient** and **Doctor** — sharing a single React Native codebase. After login, the app detects the user's role from the JWT token and routes them into their respective experience: the patient-facing discovery and booking flow, or the clinic management dashboard.

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│          Patient Frontend  (React Native)            │
│                                                     │
│   ┌──────────────────┐   ┌────────────────────────┐ │
│   │  Patient Screens  │   │    Doctor Screens       │ │
│   │  Home, Search,    │   │  Dashboard, Patients,  │ │
│   │  Booking, Chat,   │   │  Bills, Rewards,       │ │
│   │  Appointments,    │   │  Gallery, Inbox,       │ │
│   │  Notifications    │   │  Appointments          │ │
│   └──────────────────┘   └────────────────────────┘ │
│              ↕  Role-based navigation (JWT)          │
└─────────────────────────────────────────────────────┘
                          │ HTTP / REST
                          ▼
┌─────────────────────────────────────────────────────┐
│        Combined Backend  (Node.js + Express)         │
│                                                     │
│  Auth  ·  Users  ·  Doctors  ·  Appointments        │
│  Bills  ·  Chat  ·  Reviews  ·  Rewards             │
│  Gallery  ·  Notifications  ·  Favorites            │
└─────────────────────────────────────────────────────┘
                          │ Mongoose ODM
                          ▼
              ┌───────────────────────┐
              │   MongoDB Atlas / local│
              └───────────────────────┘
```

Both patient and doctor flows live in **one app** (`Patient Frontend`). The separate `Doctor Frontend` folder is a standalone scaffold for a future independent doctor app and is not yet connected to the backend.

---

## Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Mobile Framework | React Native + Expo SDK | 54 |
| Navigation | React Navigation v7 | Stack + Bottom Tabs |
| HTTP Client | Axios | ^1.16 |
| Secure Storage | expo-secure-store | ~15.0 |
| Image Picker | expo-image-picker | ~17.0 |
| Backend Runtime | Node.js + Express | ^4.21 |
| Authentication | JWT (access + refresh tokens) | jsonwebtoken ^9 |
| Password Hashing | bcryptjs | ^2.4 |
| Database | MongoDB + Mongoose | ^8.7 |
| File Uploads | Multer (disk storage) | ^1.4 |
| Input Validation | express-validator | ^7.2 |
| Dev Server Reload | nodemon | ^3.1 |

---

## Project Structure

After extracting the zip you will have:

```
dentist/
│
├── README.md
│
├── Combined Backend/                   # Node.js Express API (serves both roles)
│   ├── config/
│   │   └── db.js                       # MongoDB connection (Mongoose)
│   ├── controllers/                    # Business logic
│   │   ├── auth.controller.js
│   │   ├── user.controller.js
│   │   ├── doctor.controller.js
│   │   ├── appointment.controller.js
│   │   ├── bill.controller.js
│   │   ├── chat.controller.js
│   │   ├── review.controller.js
│   │   ├── reward.controller.js
│   │   ├── payment.controller.js
│   │   ├── gallery.controller.js
│   │   ├── notification.controller.js
│   │   ├── treatment.controller.js
│   │   └── favorite.controller.js
│   ├── models/                         # Mongoose schemas
│   │   ├── User.js
│   │   ├── DoctorProfile.js
│   │   ├── PatientProfile.js
│   │   ├── Appointment.js
│   │   ├── Bill.js
│   │   ├── ChatMessage.js
│   │   ├── Review.js
│   │   ├── Reward.js
│   │   ├── Payment.js
│   │   ├── Gallery.js
│   │   ├── Notification.js
│   │   ├── Treatment.js
│   │   └── Favorite.js
│   ├── middleware/
│   │   ├── auth.js                     # JWT protect middleware
│   │   ├── roleCheck.js                # Role-based access control
│   │   ├── errorHandler.js
│   │   └── validate.js
│   ├── routes/                         # Express routers (one file per resource)
│   ├── utils/
│   │   └── seedData.js                 # Full demo data seeder
│   ├── server.js                       # Entry point — listens on 0.0.0.0:5000
│   └── .env                            # Secret keys (create this — see below)
│
├── Patient Frontend/                   # Unified React Native app (patient + doctor)
│   ├── src/
│   │   ├── config/
│   │   │   ├── api.js                  # API base URL (reads EXPO_PUBLIC_API_URL)
│   │   │   └── storage.js              # Secure token storage wrapper
│   │   ├── context/
│   │   │   └── NotificationContext.js  # Global unread count + chat badge polling
│   │   ├── navigation/
│   │   │   └── AppNavigator.js         # Root stack + patient tabs + doctor tabs
│   │   └── screens/
│   │       ├── SplashScreen.js
│   │       ├── NoticeScreen.js
│   │       ├── RoleSelectionScreen.js
│   │       ├── LoginScreen.js
│   │       ├── RegisterScreen.js
│   │       ├── PatientSetupScreen.js
│   │       │
│   │       │   ── Patient Screens ─────────────────────────────
│   │       ├── HomeScreen.js
│   │       ├── SearchScreen.js
│   │       ├── BookingScreen.js
│   │       ├── AppointmentsScreen.js
│   │       ├── ProfileScreen.js
│   │       ├── DoctorProfileScreen.js
│   │       ├── PatientInboxScreen.js
│   │       ├── ChatScreen.js
│   │       ├── NotificationsScreen.js
│   │       ├── ImplantsScreen.js
│   │       ├── CosmeticScreen.js
│   │       └── OrthodonticsScreen.js
│   │
│   │           ── Doctor Screens ──────────────────────────────
│   │       └── doctor/
│   │           ├── DoctorHomeScreen.js
│   │           ├── DoctorAppointmentsScreen.js
│   │           ├── DoctorPatientsScreen.js
│   │           ├── DoctorInboxScreen.js
│   │           ├── DoctorProfileScreen.js
│   │           ├── DoctorRegisterScreen.js
│   │           ├── ClinicSetupScreen.js
│   │           └── tabs/
│   │               ├── AboutTab.js
│   │               ├── TreatmentsTab.js
│   │               ├── GalleryTab.js
│   │               ├── ReviewsTab.js
│   │               ├── AppointmentsTab.js
│   │               ├── BillsTab.js
│   │               └── RewardsTab.js
│   │
│   ├── App.js                          # App root — wraps context providers
│   ├── app.json                        # Expo config
│   └── .env                            # EXPO_PUBLIC_API_URL (create this — see below)
│
└── Doctor Frontend/                    # Standalone doctor app scaffold (WIP)
    └── ...                             # Not yet connected to backend
```

---

## Features

### Patient App
- Browse and search dental specialists by category (Implants, Cosmetic, Orthodontics)
- Filter by clinic tier (Standard / Modern / Elite) based on facility score
- Book appointments with date, time slot, and treatment notes
- Real-time chat with doctors (read/delivered receipts)
- View bills, pay online, and download receipts
- Earn loyalty reward points per appointment/payment
- Push-style notifications for appointments, bills, and messages
- Live unread chat badge on the chat icon (updates every 5 seconds)

### Doctor App
- Role-based onboarding: clinic setup, PMDC verification, profile photo
- Clinic facility scoring system → Standard / Modern / Elite badge
- Accept, decline, or complete patient appointments
- Generate invoices, apply reward discounts, track payment status
- Upload Before & After gallery images for the public profile
- Real-time inbox with unread badge on the tab bar
- Reward code generation and transaction history

---

## API Reference

All endpoints are prefixed with `http://localhost:5000`. Protected routes require `Authorization: Bearer <token>`.

| Route Group | Prefix | Notes |
|---|---|---|
| Authentication | `/api/auth` | Register, login, refresh token |
| Users | `/api/users` | Get/update current user profile |
| Doctors | `/api/doctors` | List, search, get doctor profile |
| Treatments | `/api/treatments` | CRUD for a clinic's treatment menu |
| Appointments | `/api/appointments` | Book, list, confirm, complete |
| Bills | `/api/bills` | Generate, pay, download receipt |
| Reviews | `/api/reviews` | Submit and fetch doctor reviews |
| Rewards | `/api/rewards` | Points history and redemption |
| Payments | `/api/payments` | Payment methods (add, list, delete) |
| Gallery | `/api/gallery` | Before/after photo upload and list |
| Notifications | `/api/notifications` | Unread count and mark-as-read |
| Chat | `/api/chat` | Conversation list and messages |
| Favorites | `/api/favorites` | Save and unsave doctor profiles |

Health check: `GET /` — returns server status and all endpoint keys.

---

## Environment Variables

### Backend — `Combined Backend/.env`

Create a file named `.env` inside the `Combined Backend` folder:

```env
PORT=5000
MONGODB_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/Med_App
JWT_SECRET=replace_with_a_strong_random_string
JWT_EXPIRE=7d
JWT_REFRESH_SECRET=replace_with_a_different_strong_random_string
JWT_REFRESH_EXPIRE=30d
NODE_ENV=development
```

### Frontend — `Patient Frontend/.env`

Create a file named `.env` inside the `Patient Frontend` folder:

```env
# Pick the line that matches your setup and remove the others:

EXPO_PUBLIC_API_URL=http://10.0.2.2:5000        # Android emulator
EXPO_PUBLIC_API_URL=http://localhost:5000         # iOS simulator / web browser
EXPO_PUBLIC_API_URL=http://192.168.1.100:5000    # Physical device — use your PC's LAN IP
EXPO_PUBLIC_API_URL=https://xxxx.ngrok-free.dev  # ngrok tunnel
```

> The `EXPO_PUBLIC_` prefix is required. Expo automatically injects variables with this prefix into the JavaScript bundle. A plain variable name like `MY_VAR` is ignored.

---

## How to Run

Open **two terminals** — one for the backend, one for the app. Start the backend first.

### Prerequisites

| Tool | Minimum Version |
|---|---|
| Node.js | 18.x or higher |
| npm | 9.x or higher |
| MongoDB | Atlas cluster **or** local MongoDB 6+ |
| Expo Go (optional) | Latest — install on your phone to test on a physical device |

---

### Step 1 — Start the Backend

```bash
# 1. Open a terminal and navigate into the Combined Backend folder
cd dentist/Combined Backend

# 2. Install dependencies
npm install

# 3. Create the .env file (see Environment Variables section above)

# 4a. Start in production mode
npm start

# 4b. OR start in development mode (auto-restarts on file save)
npm run dev
```

When the server is running you will see:

```
🦷 ═══════════════════════════════════════
   MyDentist API Server
   Running on: http://0.0.0.0:5000
   Accepting connections from ANY device
   Environment: development
🦷 ═══════════════════════════════════════
✅ MongoDB Connected: cluster.mongodb.net
```

Confirm it works: open `http://localhost:5000` in a browser — you should see a JSON health-check response.

---

### Step 2 — Start the Patient & Doctor App

Both the patient-facing app and the doctor dashboard are inside `Patient Frontend`. Open a **second terminal**:

```bash
# 1. Navigate into the Patient Frontend folder
cd dentist/Patient Frontend

# 2. Install dependencies
npm install

# 3. Create the .env file (see Environment Variables section above)

# 4. Start the Expo Metro bundler
npm start
```

The Expo CLI will display a QR code and the following key options:

| Key | Action |
|---|---|
| `a` | Open on Android emulator (requires Android Studio) |
| `i` | Open on iOS simulator (requires Xcode, macOS only) |
| `w` | Open in web browser |
| Scan QR | Open in Expo Go on a physical Android/iOS device |

**Finding your PC's local IP (for physical device testing):**
- Windows: open Command Prompt → run `ipconfig` → look for **IPv4 Address**
- Mac/Linux: run `ifconfig | grep "inet "` in Terminal

Set that IP in `Patient Frontend/.env`:
```env
EXPO_PUBLIC_API_URL=http://192.168.x.x:5000
```

Both your phone and PC must be on the same Wi-Fi network.

#### User Roles After Login

- Register → select **Patient** → complete the patient setup form → routed to the patient home screen
- Register → select **Doctor** → complete clinic registration → routed to the doctor dashboard

The app reads the role from the JWT token automatically and shows the correct interface.

---

### Step 3 — Doctor Standalone App (Optional / WIP)

`Doctor Frontend` is an independent Expo scaffold not yet connected to the backend.

```bash
cd dentist/Doctor Frontend
npm install
npm start
```

No `.env` configuration is required at this stage.

---

## Database Seeding

The backend includes a seed script that creates demo doctors, clinic profiles, treatments, reviews, and reward transactions.

```bash
# From inside the Combined Backend folder:
npm run seed

# Or run the advanced doctor seeder directly:
node seed_doctors_advanced.js
```

---

## Postman Testing

A ready-to-import Postman collection is included inside `Combined Backend`.

1. Open Postman → **Import** → select `MyDentist_Complete_Collection.json`
2. Set the `base_url` collection variable to `http://localhost:5000`
3. Run **Auth / Register** or **Auth / Login** first — the collection saves the returned token automatically
4. All protected requests use `{{token}}` in the `Authorization: Bearer {{token}}` header

---

## Troubleshooting

| Problem | Cause | Fix |
|---|---|---|
| `MongoDB Connection Error` | Wrong URI in `.env` | Check `MONGODB_URI`. For Atlas, whitelist your IP under Network Access. |
| `Network request failed` on phone | App can't reach backend | Set `EXPO_PUBLIC_API_URL` to your PC's LAN IP (`ipconfig`), not `localhost`. Both devices must be on the same Wi-Fi. |
| `Network request failed` on Android emulator | Wrong loopback host | Use `http://10.0.2.2:5000` — the emulator maps this address to the host machine. |
| `Cannot find module` on backend start | `npm install` not run | Run `npm install` inside `Combined Backend/`. |
| App shows blank screen after login | Metro cache issue | Press `r` in the Expo terminal to reload, or run `npx expo start --clear`. |
| Token expired / auto-logged out | JWT secret changed | Make sure `JWT_SECRET` in `Combined Backend/.env` has not changed between sessions. |
| Uploaded images not loading | `uploads/` folder missing | Create an empty folder named `uploads` inside `Combined Backend/`. |
