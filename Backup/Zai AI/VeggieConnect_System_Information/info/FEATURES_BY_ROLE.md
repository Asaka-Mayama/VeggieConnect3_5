# VeggieConnect — Feature Inventory by Role

Compiled from the component tree (`src/components/`), BUILD_INFO.txt (Build v3.4) and server.ts.

## Buyer (self-registered, admin-approved)

- Market browsing with produce cards; "Add to Cart" only (request button removed in v3.3.x)
- Cart drawer with two minimums enforced: 60 kg total order AND 20 kg per product
- Purchase requests raised from the Cart (RequestCropsModal; picker filled live from the market menu)
- Orders screen showing the pay-after-approval sequence:
  pending → "Awaiting Admin approval" → "Order approved — pay to start the transaction" → PAID ✓ WALLET
- VeggieConnect Pay wallet: deposit (₱500 / ₱1,000 / ₱2,000 / ₱5,000 + custom), payment, refunds, full history
- Order rating modal after completion; refunds for lines marked unavailable (order continues)
- Direct chat with farmers and the admin (text + compressed photo attachments)
- Profile menu with editable details; mandatory map pin at registration

## Farmer (self-registered, admin-approved)

- Farmer dashboard (FarmerDashboardView) and produce management via AddProduceModal
  (name, category, variety, price, unit, stock, minimum order, harvest status/date, farming method, photos)
- Orders menu grouped by transaction date with total sales per date (daily ledger)
- Farm profile (FarmProfileModal) and farm-route map visualisation
- Direct chat with buyers and the admin
- Wallet view shared with the buyer wallet implementation

## DA Admin (fixed account admin@gmail.com, /admin route)

- Pending User Verifications queue: review uploaded Valid Government ID
  (+ optional business proof / RSBSA number) and approve or reject
- User management: edit profiles, delete users with cascade
  (their product listings removed; deleted identity purged from the login-screen registry so they can re-register)
- Warehouse Stocks: procured stock management with per-card delete buttons
- Buyer Requests: approve orders; "Mark Unavailable & Return Amount" refunds the buyer wallet per product line
- Live Transport: advance hauls; refuses unpaid orders ("Buyer payment required");
  tracks pickup farm → drop-off, estimated weight and earnings
- All Ledger: transactions categorised by date, split farmer-vs-buyer
- Admin analytics view; DA Price Watch bulletin maintenance (sync endpoint backed by da_price_bulletin)
- Supermarket hub profile with address and GPS pin
- Guarded Reset Demo Data action (only when VITE_ENABLE_DEMO_RESET="true")

## System-wide behaviours

- DA verification gate: no transactional access until explicit admin approval
- Duplicate identity blocking (name / phone / e-mail) at registration, server is the source of truth
- Pending-signup and pending-deletion self-heal queues replay when the backend was unreachable
- Chat, orders, transport jobs and wallet balances persist in MySQL across restarts
- SPA fallback routing; public project guide at /system; standalone admin console at /admin
