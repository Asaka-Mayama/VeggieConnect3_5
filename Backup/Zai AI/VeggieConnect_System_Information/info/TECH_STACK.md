# VeggieConnect — Technology Stack

Extracted from `package.json` (v3.3.3) and `server.ts`.

## Runtime at a glance

| Layer | Technology | Version | Why it is there |
|---|---|---|---|
| UI framework | React | ^19.0.1 | Role-based single-page app (buyer, farmer, admin in one bundle) |
| Build tool | Vite | ^8.3.0 | Dev server and production bundling (`npm run build`) |
| Styling | Tailwind CSS | ^4.3.3 | Utility-first styling via @tailwindcss/vite plugin |
| Backend | Express | ^4.21.2 | One TypeScript file (`server.ts`) hosts 27 REST endpoints + built SPA |
| TypeScript runner | tsx | ^4.21.0 | Runs server.ts directly in dev and production |
| Database client | mysql2 | ^3.24.6 | Connection pool; schema auto-provisioned on boot |
| Database | MySQL (XAMPP) | — | Durable storage, 6 tables |
| Maps | @vis.gl/react-google-maps | ^1.10.1 | Address pin picker, farm-route map |
| AI | @google/genai | ^2.4.0 | Gemini API calls guarded by GEMINI_API_KEY |
| Icons / animation | lucide-react / motion | 0.546.0 / 12.x | UI icons and transitions |
| Type checking | TypeScript (tsc --noEmit) | ^7.0.2 | `npm run lint` |
| Dev DB option | mysql-memory-server | ^1.18.0 | Used by `npm run dev:mysql` for a managed instance |

## How the pieces connect

1. Browser loads the React SPA (dev: Vite dev server; production: Express serves `dist/`).
2. The SPA calls same-origin REST endpoints (see `API_ENDPOINTS.md`).
3. Express enforces business rules (duplicates, minimums, pay-after-approval, cascades)
   and reads/writes MySQL through the pool.
4. On boot the server creates missing tables and adds missing columns (28 ALTER migrations).
5. Optional external calls: Google Maps (browser) and Gemini (server-side).
