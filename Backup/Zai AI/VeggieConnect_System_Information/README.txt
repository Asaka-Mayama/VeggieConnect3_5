VEGGIECONNECT — SYSTEM INFORMATION PACKAGE
Prepared: November 15, 2026 (from source: VeggieConnect3_4, Build v3.4)

WHAT IS INSIDE

1. VeggieConnect_System_Documentation.docx
   The full technical reference (18 pages): overview, roles, architecture,
   feature modules, data design, API reference, workflows, deployment guide,
   security notes and maintenance history. Open in Word/WPS; right-click the
   Table of Contents and choose "Update Field" to refresh page numbers.
2. VeggieConnect_System_Documentation.pdf
   Read-only preview of the same document.
3. diagrams/
   - architecture.png   — layered system architecture (client → presentation → application → data → external services)
   - erd.png            — entity-relationship diagram of the six MySQL tables
   - order_flow.png     — order lifecycle across its five phases (pay-after-approval gate)
   - *.html             — editable HTML sources for each diagram (open in a browser, screenshot to re-render)
4. info/
   - API_ENDPOINTS.md      — all 28 route handlers, extracted from server.ts with line numbers
   - DATABASE_SCHEMA.md    — column-level schema: CREATE TABLE blocks + all 28 boot-time migrations
   - FEATURES_BY_ROLE.md   — feature inventory for buyer, farmer and DA Admin
   - TECH_STACK.md         — technologies, versions and their roles
   - SETUP_GUIDE.md        — local deployment with XAMPP, env vars, verification checklist
   - PROJECT_STRUCTURE.txt — full file tree of the repository
   - source/               — the repository's own reference files, unmodified
                             (README.md, BUILD_INFO.txt, .env.example, metadata.json, Caddyfile)

SUGGESTED USE

Chapters 1–4 → introduction and system description; chapters 5–7 → data design,
interface specification and process flows; chapters 8–9 → implementation and
deployment; the PNG diagrams paste directly into slides or reports.
