# VeggieConnect — REST API Endpoint Reference

Extracted automatically from `server.ts` (source of truth).
Total route handlers: **28**.

## Auth

| Method | Path | server.ts line |
|---|---|---|
| POST | `/api/auth/signup` | 743 |
| POST | `/api/auth/login` | 933 |

## Users & Wallet

| Method | Path | server.ts line |
|---|---|---|
| PUT | `/api/users/:id` | 1098 |
| DELETE | `/api/users/:id` | 1215 |
| GET | `/api/users` | 1248 |
| POST | `/api/users/:id/wallet` | 1310 |

## Supermarket Hub

| Method | Path | server.ts line |
|---|---|---|
| GET | `/api/supermarket` | 1460 |
| PUT | `/api/supermarket` | 1464 |

## Products

| Method | Path | server.ts line |
|---|---|---|
| GET | `/api/products` | 1487 |
| POST | `/api/products` | 1537 |
| PUT | `/api/products/:id` | 1674 |
| DELETE | `/api/products/:id` | 1751 |

## Orders

| Method | Path | server.ts line |
|---|---|---|
| GET | `/api/orders` | 1794 |
| POST | `/api/orders` | 2228 |
| PUT | `/api/orders/:id` | 2347 |

## Transport Jobs

| Method | Path | server.ts line |
|---|---|---|
| GET | `/api/transport-jobs` | 2583 |
| POST | `/api/transport-jobs` | 2609 |
| PUT | `/api/transport-jobs/:id` | 2621 |

## Direct Messages

| Method | Path | server.ts line |
|---|---|---|
| GET | `/api/messages` | 2716 |
| POST | `/api/messages` | 2720 |
| PUT | `/api/messages/read-all` | 2735 |
| POST | `/api/messages/mark-read` | 2749 |

## DA Prices

| Method | Path | server.ts line |
|---|---|---|
| GET | `/api/da-prices` | 3310 |
| POST | `/api/da-prices/sync` | 3354 |

## System

| Method | Path | server.ts line |
|---|---|---|
| GET | `/api/health` | 723 |
| POST | `/api/reset-all` | 1767 |
| GET | `/api/xampp/export` | 3366 |
| GET | `*` | 3554 |
