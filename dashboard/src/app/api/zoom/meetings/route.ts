import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getValidZoomToken, getZoomMeetings } from '@/lib/zoom';

export async function GET() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    try {
        const accessToken = await getValidZoomToken(supabase);
        const meetingsData = await getZoomMeetings(accessToken);

        console.log(`Zoom API returned ${meetingsData.meetings?.length || 0} meetings`);

        // Let's be less restrictive for now to see what's coming back
        const meetings = meetingsData.meetings || [];

        return NextResponse.json({ meetings });
    } catch (error: any) {
        console.error('Meetings API Error:', error);
        return NextResponse.json({ error: error.message }, { status: error.message === 'Zoom not connected' ? 401 : 500 });
    }
}
