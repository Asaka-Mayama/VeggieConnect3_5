# VeggieConnect — Setup Guide (local deployment with XAMPP)

Verified against README.md and the defaults in server.ts.

## Prerequisites

- Node.js (or Bun) installed
- XAMPP with the MySQL module available
- The source folder extracted on its own (do not mix with an older copy)

## Steps

1. **Configure environment** — copy `.env.example` to `.env` and set:
   - `ADMIN_PASSWORD` (the admin login accepts it plus documented demo fallbacks; set a private value)
   - `GEMINI_API_KEY` (only needed for the AI features)
2. **Start MySQL** — launch XAMPP's MySQL module.
   Optionally import `veggie_connect2.sql` (or `veggie_connect3.sql`) via phpMyAdmin;
   the server also provisions and migrates the schema automatically on boot.
3. **Install dependencies** — `npm install --legacy-peer-deps` (or `bun install`).
4. **Run the app** — `npm run dev` (development) or `npm run build` + `npm start`
   (production: Express serves the built SPA).
5. **Open and refresh** — open the printed URL and hard-refresh (Ctrl+Shift+R).

## Important flags

- Keep `VITE_ENABLE_DEMO_RESET="false"` for real use. Only set it to `"true"`
  when you deliberately want the Reset Demo Data button / `/api/reset-all` to wipe everything.
- MySQL defaults in code: host 127.0.0.1, port 3306, user root, empty password,
  database `veggie_connect3` — matching a stock XAMPP install. Override via
  `MYSQL_HOST` / `MYSQL_PORT` / `MYSQL_USER` / `MYSQL_PASSWORD` / `MYSQL_DATABASE`.

## Roles and first login

- Admin: log in at the `/admin` route with `admin@gmail.com` and your `ADMIN_PASSWORD`.
- Buyers and farmers: register from the app root (Valid Government ID photo required,
  location pinned on the map), then approve them from the admin console's
  Pending User Verifications queue before they can transact.

## Quick verification checklist

- `GET /api/health` reports MySQL connectivity.
- Registering a buyer appears in the admin's verification queue.
- Placing a 60+ kg order → approve → pay from wallet → advance in Live Transport
  → stock reduces on completion.
- Deleting a user in admin, then re-registering the same name/phone/e-mail, succeeds
  (deleted-user re-registration fix).
