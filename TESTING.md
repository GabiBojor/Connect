# Testing Webhooks

## Prerequisites
- Supabase CLI installed
- Deno installed

## Setup Local Environment
1. Start Supabase:
   ```bash
   supabase start
   ```
2. Serve Functions:
   ```bash
   supabase functions serve
   ```
3. Get the `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from the output of `supabase start`.

## Run Simulation
1. Edit `simulate_webhooks.ts` (or set environment variables) with your credentials.
2. Run the script:
   ```bash
   deno run --allow-net --allow-env --allow-read simulate_webhooks.ts
   ```

## Alternative (Direct DB)
If you just want to test the database insertion logic without the Edge Function overhead locally, uncomment the DB insertion section in `simulate_webhooks.ts` and ensure you have the `postgres` connection string or Supabase client configured.
