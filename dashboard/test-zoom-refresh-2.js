const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './.env' }); // Load ZOOM_CLIENT_ID etc.
require('dotenv').config({ path: './.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);
const ZOOM_API_BASE = 'https://zoom.us';

async function refreshZoomToken(refreshToken) {
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

async function getValidZoomToken(supabase) {
    const { data: connection, error } = await supabase
        .from('zoom_connections')
        .select('*')
        .maybeSingle();

    if (error || !connection) {
        throw new Error('Zoom not connected');
    }

    // DO THE REFRESH
    const newTokens = await refreshZoomToken(connection.refresh_token);
    console.log("Tokens refreshed!! Payload:", newTokens);

    const { data, error: updateError } = await supabase
        .from('zoom_connections')
        .update({
            access_token: newTokens.access_token,
            // If newTokens.refresh_token is undefined, we might inadvertently clear it?
            refresh_token: newTokens.refresh_token || connection.refresh_token,
            expires_at: new Date(Date.now() + newTokens.expires_in * 1000).toISOString(),
            updated_at: new Date().toISOString()
        })
        .eq('id', connection.id)
        .select();

    if (updateError) {
        console.error("Failed to update in Supabase:", updateError);
        throw updateError;
    }

    console.log("Update success!", data);

    return newTokens.access_token;
}

getValidZoomToken(supabase).then(token => console.log("Success!")).catch(err => console.error("Final Error: ", err.message));
