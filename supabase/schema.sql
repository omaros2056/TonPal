-- SatSplit AI — Supabase schema
-- Run this in your Supabase SQL editor

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ─── split_sessions ──────────────────────────────────────────────────────────
create table if not exists split_sessions (
  id            uuid primary key default uuid_generate_v4(),
  owner_id      text not null,          -- Telegram user ID or anonymous ID
  source        text not null check (source in ('bot', 'miniapp')),
  status        text not null default 'draft'
                  check (status in ('draft', 'active', 'settled', 'cancelled')),
  receipt_data  jsonb,                  -- ReceiptScan JSON
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ─── participants ─────────────────────────────────────────────────────────────
create table if not exists participants (
  id                  uuid primary key default uuid_generate_v4(),
  split_session_id    uuid not null references split_sessions(id) on delete cascade,
  telegram_user_id    text,
  display_name        text not null,
  ens_name            text,             -- alice.eth
  satsplit_subname    text,             -- alice.satsplit.eth
  handle              text,             -- @alice
  ton_address         text,
  evm_address         text,
  xrp_address         text,
  avatar_url          text,
  created_at          timestamptz not null default now()
);

-- ─── payment_requests ────────────────────────────────────────────────────────
create table if not exists payment_requests (
  id                uuid primary key default uuid_generate_v4(),
  split_session_id  uuid not null references split_sessions(id) on delete cascade,
  participant_id    uuid not null references participants(id) on delete cascade,
  amount            numeric(12,2) not null,   -- fiat amount
  amount_native     numeric(18,9),             -- TON or XRP amount
  status            text not null default 'pending'
                      check (status in ('pending', 'committed', 'confirmed', 'overdue', 'cancelled')),
  payment_link      text not null,
  rail              text not null check (rail in ('ton', 'xrpl')),
  xrpl_check_id     text,                      -- XRPL check object ID
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ─── payment_receipts ────────────────────────────────────────────────────────
create table if not exists payment_receipts (
  id                  uuid primary key default uuid_generate_v4(),
  payment_request_id  uuid not null references payment_requests(id) on delete cascade,
  tx_hash             text not null,
  rail                text not null check (rail in ('ton', 'xrpl')),
  paid_at             timestamptz not null default now()
);

-- ─── xrpl_checks ─────────────────────────────────────────────────────────────
create table if not exists xrpl_checks (
  id                  uuid primary key default uuid_generate_v4(),
  split_session_id    uuid not null references split_sessions(id) on delete cascade,
  participant_id      uuid not null references participants(id) on delete cascade,
  payment_request_id  uuid references payment_requests(id),
  check_id            text,             -- XRPL ledger check object ID
  xrp_amount          text not null,
  state               text not null default 'created'
                        check (state in ('created', 'cashed', 'cancelled', 'expired')),
  xumm_payload_uuid   text,
  xumm_qr_url         text,
  xumm_deeplink       text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ─── Indexes ─────────────────────────────────────────────────────────────────
create index if not exists idx_participants_session on participants(split_session_id);
create index if not exists idx_payment_requests_session on payment_requests(split_session_id);
create index if not exists idx_payment_requests_participant on payment_requests(participant_id);
create index if not exists idx_payment_receipts_request on payment_receipts(payment_request_id);
create index if not exists idx_xrpl_checks_session on xrpl_checks(split_session_id);

-- ─── Real-time (enable for status board) ─────────────────────────────────────
alter publication supabase_realtime add table payment_requests;
alter publication supabase_realtime add table payment_receipts;
alter publication supabase_realtime add table xrpl_checks;
