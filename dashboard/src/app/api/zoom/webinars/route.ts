
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getValidZoomToken, getZoomWebinars } from '@/lib/zoom';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET() {
    try {
        const accessToken = await getValidZoomToken(supabase);
        const webinars = await getZoomWebinars(accessToken);

        return NextResponse.json(webinars);
    } catch (error: any) {
        console.error('Zoom Webinars API Error:', error);
        return NextResponse.json({ error: error.message }, { status: error.message === 'Zoom not connected' ? 401 : 500 });
    }
}
