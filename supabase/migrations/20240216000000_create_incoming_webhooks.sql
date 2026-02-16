-- Create the incoming_webhooks table
create table public.zap_incoming_webhooks (
  id uuid not null default gen_random_uuid(),
  source text not null, -- 'typeform' or 'zoom'
  payload jsonb not null,
  status text not null default 'pending', -- 'pending', 'processed', 'failed'
  created_at timestamptz not null default now(),
  constraint zap_incoming_webhooks_pkey primary key (id)
);

-- Index for faster querying of pending webhooks
create index idx_zap_incoming_webhooks_status on public.zap_incoming_webhooks (status);

-- Enable Row Level Security (RLS)
alter table public.zap_incoming_webhooks enable row level security;

-- Policy: Allow Service Role to do everything (Edge Functions use Service Role)
create policy "Service Role can do everything"
  on public.zap_incoming_webhooks
  for all
  to service_role
  using (true)
  with check (true);

-- Optional: Create a database webhook to notify an external HTTP endpoint (The Agent)
-- Requires pg_net extension enabled in Supabase Dashboard
-- create extension if not exists pg_net;

-- create trigger "new_webhook_trigger"
-- after insert on public.zap_incoming_webhooks
-- for each row
-- execute function supabase_functions.http_request(
--   'POST',
--   'https://your-mcp-server-url.vercel.app/api/webhook-trigger', -- Replace with actual Agent URL
--   '{"Content-Type":"application/json"}',
--   '{}',
--   '1000'
-- );
