### 1. Configure Environment Variables

Create a file named `.env.local` inside the `dashboard` directory.
Add your Supabase credentials. You can find these in your Supabase Project Settings -> API.

```env
NEXT_PUBLIC_SUPABASE_URL=your_project_url (e.g. https://xyz.supabase.co)
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

### 2. Install Supabase CLI (if using local development)

If `supabase start` failed, you might need to install the CLI:

```bash
brew install supabase/tap/supabase
```

Then start it:
```bash
supabase start
```

### 3. Run the Dashboard

```bash
cd dashboard
npm run dev
```
