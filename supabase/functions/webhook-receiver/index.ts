import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.177.0/crypto/mod.ts";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        const url = new URL(req.url);
        // Determine source from URL query param or path? Let's use query param ?source=typeform|zoom
        const source = url.searchParams.get('source');

        if (!source || !['typeform', 'zoom'].includes(source)) {
            return new Response(JSON.stringify({ error: 'Invalid or missing source parameter' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        const bodyText = await req.text();

        // SECURITY CHECK: Validate Signature
        const isVerified = await verifySignature(req, bodyText, source);
        if (!isVerified) {
            return new Response(JSON.stringify({ error: 'Invalid signature' }), {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        const payload = JSON.parse(bodyText);

        // Save to Database
        const { error } = await supabase
            .from('zap_incoming_webhooks')
            .insert({
                source,
                payload,
                status: 'pending'
            });

        if (error) throw error;

        return new Response(JSON.stringify({ message: 'Webhook received and saved' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});

async function verifySignature(req: Request, bodyText: string, source: string): Promise<boolean> {
    // In development/dry-run, you might want to bypass this or check a specific header
    const signature = req.headers.get(source === 'typeform' ? 'Typeform-Signature' : 'x-zm-signature');

    // TODO: Add actual secret verification logic here using Deno.env.get('TYPEFORM_SECRET') etc.
    // For now, we'll return true to allow testing, but this MUST be implemented for production.

    if (source === 'typeform') {
        // Typeform logic: sha256=base64(...)
        // const secret = Deno.env.get('TYPEFORM_SECRET');
        // if (!signature || !secret) return false;
        // ... verify ...
        return true; // Placeholder
    }

    if (source === 'zoom') {
        // Zoom logic
        // const secret = Deno.env.get('ZOOM_SECRET');
        // if (!signature || !secret) return false;
        // ... verify ...
        return true; // Placeholder
    }

    return true;
}
