const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './.env' }); // Load ZOOM_CLIENT_ID etc.
require('dotenv').config({ path: './.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl) {
    console.log('No SUPABASE_URL found');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const ZOOM_API_BASE = 'https://zoom.us';

async function refreshZoomToken(refreshToken) {
    const clientId = process.env.ZOOM_CLIENT_ID;
    const clientSecret = process.env.ZOOM_CLIENT_SECRET;

    console.log("Refreshing with Client ID:", clientId ? 'exists' : 'missing');

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

async function getValidZoomToken(supabase) {
    const { data: connection, error } = await supabase
        .from('zoom_connections')
        .select('*')
        .maybeSingle();

    if (error || !connection) {
        throw new Error('Zoom not connected');
    }

    const now = new Date();
    const expiresAt = new Date(connection.expires_at);

    if (expiresAt.getTime() - now.getTime() < 5 * 60 * 1000) {
        console.log("Refreshing Zoom token...");
        try {
            const newTokens = await refreshZoomToken(connection.refresh_token);
            console.log("Tokens refreshed!!");
            return newTokens.access_token;
        } catch (e) {
            console.error(e);
            throw e;
        }
    }

    return connection.access_token;
}

getValidZoomToken(supabase).then(token => console.log("Success!")).catch(err => console.error("Final Error: ", err.message));
