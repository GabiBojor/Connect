
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getZoomAccessToken, getZoomUser } from '@/lib/zoom';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');

    if (!code) {
        return NextResponse.json({ error: 'No code provided' }, { status: 400 });
    }

    try {
        // 1. Exchange code for tokens
        const tokens = await getZoomAccessToken(code);

        // 2. Get Zoom user info to identify the account
        const zoomUser = await getZoomUser(tokens.access_token);

        // 3. Store in Supabase
        const { error } = await supabase
            .from('zoom_connections')
            .upsert({
                zoom_account_id: zoomUser.id,
                zoom_account_email: zoomUser.email,
                access_token: tokens.access_token,
                refresh_token: tokens.refresh_token,
                expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
                updated_at: new Date().toISOString()
            }, { onConflict: 'zoom_account_id' });

        if (error) {
            console.error('Supabase error storing Zoom tokens:', error);
            throw error;
        }

        // 4. Redirect back to dashboard integrations page
        return NextResponse.redirect(new URL('/integrations?success=zoom', req.url));
    } catch (error: any) {
        console.error('Zoom Callback Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
