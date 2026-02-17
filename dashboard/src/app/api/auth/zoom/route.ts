
import { NextResponse } from 'next/server';

export async function GET() {
    const clientId = process.env.ZOOM_CLIENT_ID;
    const redirectUri = process.env.ZOOM_REDIRECT_URI;

    if (!clientId || !redirectUri) {
        return NextResponse.json({ error: 'Zoom configuration missing' }, { status: 500 });
    }

    const zoomUrl = `https://zoom.us/oauth/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}`;

    return NextResponse.redirect(zoomUrl);
}
