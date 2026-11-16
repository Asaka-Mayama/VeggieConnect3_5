# VeggieConnect — Database Schema (extracted from server.ts)

The server provisions the schema itself on boot: `CREATE TABLE IF NOT EXISTS` for the
five core tables, followed by idempotent `ALTER TABLE ... ADD COLUMN` migrations for
every column introduced after the original schema. Importing the SQL dumps in the
repository (veggie_connect2.sql / veggie_connect3.sql) is therefore optional.

## Table `users`

```sql
CREATE TABLE IF NOT EXISTS users (
          id VARCHAR(64)
```

## Table `products`

```sql
CREATE TABLE IF NOT EXISTS products (
        id VARCHAR(64)
```

## Table `orders`

```sql
CREATE TABLE IF NOT EXISTS orders (
        id VARCHAR(64)
```

## Table `transport_jobs`

```sql
CREATE TABLE IF NOT EXISTS transport_jobs (
        id VARCHAR(64)
```

## Table `direct_messages`

```sql
CREATE TABLE IF NOT EXISTS direct_messages (
          id VARCHAR(64)
```

## Columns added automatically by boot-time migrations

| Table | Added column |
|---|---|
| users | status ENUM('active', 'pending', 'suspended') NOT NULL DEFAULT 'active' |
| users | is_verified TINYINT(1) DEFAULT 1 |
| users | latitude DOUBLE NULL |
| users | longitude DOUBLE NULL |
| users | wallet_balance DECIMAL(12, 2) NOT NULL DEFAULT 0 |
| users | wallet_transactions LONGTEXT NULL |
| users | verification_status VARCHAR(20) NOT NULL DEFAULT 'Pending' |
| users | valid_id_image LONGTEXT NULL |
| users | rsbsa_number VARCHAR(60) NULL |
| users | business_proof_image LONGTEXT NULL |
| users | submitted_at VARCHAR(100) NULL |
| products | seller_status VARCHAR(60) DEFAULT 'submitted' |
| products | broker_status VARCHAR(60) DEFAULT 'approved_active' |
| products | seller_store_name VARCHAR(150) |
| products | farmgate_asking_price DECIMAL(10, 2) |
| products | bought_quantity INT DEFAULT 0 |
| products | bought_at VARCHAR(100) |
| products | sourcing_region VARCHAR(150) |
| products | latitude DOUBLE NULL |
| products | longitude DOUBLE NULL |
| orders | vehicle_type VARCHAR(100) NULL |
| orders | pickup_slot VARCHAR(150) NULL |
| orders | subtotal DECIMAL(10, 2) NULL |
| orders | delivery_fee DECIMAL(10, 2) NULL DEFAULT 0.00 |
| orders | notes TEXT NULL |
| orders | transporter_id VARCHAR(64) NULL |
| orders | transporter_name VARCHAR(120) NULL |
| orders | transporter_phone VARCHAR(50) NULL |

## Reference table: `da_price_bulletin`

Provided by the SQL dumps (not auto-created in server.ts): retail/farm-gate prices,
price ranges, trend and market center for the DA Price Watch feature.