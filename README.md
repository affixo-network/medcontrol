# Affixo MedControl

Affixo MedControl is a SaaS application for monitoring medication intake in both individual and team scenarios.

The system is designed to provide clear, reliable, and transparent control over medication schedules with real-time status tracking.

---

## Core Concepts

### 1. Two Operating Modes

**Standard Mode**
- Single user monitors medication intake
- Suitable for personal use

**Team Mode**
- Multiple participants monitor one patient
- Each action is recorded with role and email
- Full transparency of responsibility

---

### 2. Daily Medication Slots

Each medication is assigned fixed daily time slots, for example:

09:00  
14:00  
22:00  

Each slot exists independently and has its own status.

---

### 3. Slot Status Logic

Each slot can have only one clear status:

- Waiting  
- Taken early  
- Taken on time  
- Taken late  
- Missed  

Key rule:

Each action is linked to the **nearest upcoming slot**, not the previous one.

Example:
- Action at 13:50 → belongs to 14:00 (early)
- It does NOT belong to 09:00

---

### 4. Time Model

- The system uses **24-hour format** only:
  - 00:00 → 23:59
- Time is based on the **user’s selected country/timezone**, not browser randomness

---

### 5. History

History records:

- actual time of action (not planned time)
- status
- role (admin / team_member)
- user email

Example:


Taken — 12.03.2026, 20:07 — admin — affixooperations@gmail.com

Missed — 12.03.2026, 14:03 — team_member — nurse@clinic.org


---

### 6. Language and Localization

- Interface language is linked to selected country
- User can manually change language
- All system text is localized

Important rule:

Medication names can be entered in **any language**, fully or partially.

---

## Demo

The application includes a fully interactive Demo mode:

- No restrictions on actions
- User can add, edit, and test freely
- Time-limited sessions:
  - Standard Mode ~45 seconds
  - Team Mode ~2 minutes
- Demo resets automatically after timeout

---

## Application Structure

- `index.html` — landing page
- `auth-login.html` — authentication
- `app.html` — main application
- `settings.html` — user settings (country, language, timezone)
- `demo.html` — interactive demo

---

## Deployment

The application is deployed via Vercel:


https://medcontrol.affixo.network


Routing:

- `/` → auth-login.html
- `/app.html` → main app
- `/demo.html` → demo
- `/settings.html` → settings

---

## Purpose

MedControl is designed to ensure:

- clarity of medication tracking
- accountability in team scenarios
- reliability of time-based monitoring
- ease of use for both individuals and organizations

---

## Status

Production-ready UI and logic.

Further improvements may include:
- backend validation hardening
- extended analytics
- notifications
