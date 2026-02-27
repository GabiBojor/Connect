const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './.env' }); // Load ZOOM_CLIENT_ID etc.
require('dotenv').config({ path: './.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function getValidZoomToken(supabase) {
    const { data: connection, error } = await supabase
        .from('zoom_connections')
        .select('*')
        .maybeSingle();

    if (error || !connection) {
        throw new Error('Zoom not connected');
    }

    // We already refreshed, so just return
    return connection.access_token;
}

async function getZoomWebinars(accessToken) {
    const response = await fetch('https://api.zoom.us/v2/users/me/webinars', { // Wait, the original code uses /v2/users/me/webinars
        headers: {
            'Authorization': `Bearer ${accessToken}`,
        },
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`Failed to fetch Zoom webinars: ${err}`);
    }

    return response.json();
}

async function getZoomMeetings(accessToken) {
    const response = await fetch('https://api.zoom.us/v2/users/me/meetings?type=upcoming', {
        headers: {
            'Authorization': `Bearer ${accessToken}`,
        },
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`Failed to fetch Zoom meetings: ${err}`);
    }

    return response.json();
}

async function run() {
    try {
        const token = await getValidZoomToken(supabase);
        console.log("Got token.");

        console.log("Fetching meetings...");
        const meetings = await getZoomMeetings(token);
        console.log("Meetings result:", meetings);

        console.log("Fetching webinars...");
        const webinars = await getZoomWebinars(token);
        console.log("Webinars result:", webinars);
    } catch (e) {
        console.error("Error:", e);
    }
}
run();
