
const ZOOM_API_BASE = 'https://zoom.us';

export async function getZoomAccessToken(code: string) {
    const clientId = process.env.ZOOM_CLIENT_ID;
    const clientSecret = process.env.ZOOM_CLIENT_SECRET;
    const redirectUri = process.env.ZOOM_REDIRECT_URI;

    const response = await fetch(`${ZOOM_API_BASE}/oauth/token`, {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
            code,
            grant_type: 'authorization_code',
            redirect_uri: redirectUri!,
        }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(`Zoom Auth Error: ${JSON.stringify(error)}`);
    }

    return response.json();
}

export async function refreshZoomToken(refreshToken: string) {
    const clientId = process.env.ZOOM_CLIENT_ID;
    const clientSecret = process.env.ZOOM_CLIENT_SECRET;

    const response = await fetch(`${ZOOM_API_BASE}/oauth/token`, {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
            refresh_token: refreshToken,
            grant_type: 'refresh_token',
        }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(`Zoom Refresh Error: ${JSON.stringify(error)}`);
    }

    return response.json();
}

export async function getZoomUser(accessToken: string) {
    const response = await fetch('https://api.zoom.us/v2/users/me', {
        headers: {
            'Authorization': `Bearer ${accessToken}`,
        },
    });

    if (!response.ok) {
        throw new Error('Failed to fetch Zoom user');
    }

    return response.json();
}

export async function getValidZoomToken(supabase: any) {
    const { data: connection, error } = await supabase
        .from('zoom_connections')
        .select('*')
        .maybeSingle();

    if (error || !connection) {
        throw new Error('Zoom not connected');
    }

    const now = new Date();
    const expiresAt = new Date(connection.expires_at);

    // Refresh if expiring in less than 5 minutes
    if (expiresAt.getTime() - now.getTime() < 5 * 60 * 1000) {
        console.log("Refreshing Zoom token...");
        const newTokens = await refreshZoomToken(connection.refresh_token);

        const { error: updateError } = await supabase
            .from('zoom_connections')
            .update({
                access_token: newTokens.access_token,
                refresh_token: newTokens.refresh_token,
                expires_at: new Date(Date.now() + newTokens.expires_in * 1000).toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq('id', connection.id);

        if (updateError) throw updateError;
        return newTokens.access_token;
    }

    return connection.access_token;
}

export async function getZoomWebinars(accessToken: string) {
    const response = await fetch('https://api.zoom.us/v2/users/me/webinars', {
        headers: {
            'Authorization': `Bearer ${accessToken}`,
        },
    });

    if (!response.ok) {
        throw new Error('Failed to fetch Zoom webinars');
    }

    return response.json();
}

export async function getZoomMeetings(accessToken: string) {
    const response = await fetch('https://api.zoom.us/v2/users/me/meetings?type=upcoming', {
        headers: {
            'Authorization': `Bearer ${accessToken}`,
        },
    });

    if (!response.ok) {
        throw new Error('Failed to fetch Zoom meetings');
    }

    return response.json();
}
