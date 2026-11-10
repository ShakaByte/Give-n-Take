-- Give'n'Take database schema (Supabase / PostgreSQL)
-- Run this whole file once in Supabase -> SQL Editor -> New query.

-- ============================================================
-- deals: one row per agreed job, with its two PayPal payments
-- status flow: pending_deposit -> in_progress -> awaiting_final -> paid
-- ============================================================
create table if not exists deals (
  id uuid primary key default gen_random_uuid(),
  job_title text not null,
  client_name text,
  deadline date,
  scope jsonb,
  pitch text,
  amount numeric(10,2) not null,
  deposit_amount numeric(10,2),
  final_amount numeric(10,2),
  status text not null default 'pending_deposit',
  deposit_order_id text,
  deposit_approve_url text,
  final_order_id text,
  final_approve_url text,
  file_path text,
  preview_path text,
  created_at timestamptz default now()
);

-- ============================================================
-- freelancer_profile: read by the AI agents on every run
-- (single demo profile, no login)
-- services example: [{"service": "Logo design", "min_rate": 150}]
-- ============================================================
create table if not exists freelancer_profile (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  profession text,
  services jsonb default '[]',
  skills text[] default '{}',
  experience_level text default 'beginner',
  hours_per_day numeric(4,1) default 4,
  created_at timestamptz default now()
);

-- ============================================================
-- todos: the freelancer's task list, read by the AI planner
-- priority: low, medium or high
-- ============================================================
create table if not exists todos (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  priority text not null default 'medium',
  due_date date,
  est_hours numeric(4,1),
  done boolean not null default false,
  created_at timestamptz default now()
);

-- ============================================================
-- Private storage bucket for final files and previews.
-- public = false keeps files locked; the backend hands out
-- short-lived signed links only after payment.
-- ============================================================
insert into storage.buckets (id, name, public)
values ('deliverables', 'deliverables', false)
on conflict (id) do nothing;

-- ============================================================
-- Row Level Security.
-- Enabled with no policies: the public (anon) key can read nothing.
-- The backend uses the secret key, which bypasses RLS, and the
-- frontend only talks to the backend, so the app keeps working.
-- ============================================================
alter table deals enable row level security;
alter table freelancer_profile enable row level security;
alter table todos enable row level security;
