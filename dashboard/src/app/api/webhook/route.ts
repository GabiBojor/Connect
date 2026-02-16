import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Supabase setup for server-side
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// GHL API Constants
const GHL_API_base = 'https://services.leadconnectorhq.com';
const GHL_Token = process.env.GHL_PIT_TOKEN;
const GHL_Location = process.env.GHL_LOCATION_ID;

export async function POST(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const payload = await req.json();
        const sourceKey = searchParams.get('source') || payload.source || 'generic_webhook';

        console.log(`--- Incoming Webhook [${sourceKey}] ---`);

        // 1. Fetch Mapping Rules
        const { data: mapping } = await supabase
            .from('zap_mappings')
            .select('*')
            .eq('source_key', sourceKey)
            .eq('is_active', true)
            .maybeSingle();

        // 2. Log to Supabase
        const { data: logData, error: dbError } = await supabase
            .from('zap_incoming_webhooks')
            .insert({
                source: sourceKey,
                payload: payload,
                status: 'processing'
            })
            .select()
            .single();

        if (dbError) console.error('Supabase Log Error:', dbError);

        // 3. Apply Mapping Logic
        let firstName = 'New';
        let lastName = 'Contact';
        let email = '';
        let phone = '';
        let tags = ['Automated Webhook'];

        if (mapping) {
            console.log('Using dynamic mapping:', mapping.name);
            const fm = mapping.field_map;
            email = getDeepValue(payload, fm.email);
            firstName = getDeepValue(payload, fm.firstName) || 'New';
            lastName = getDeepValue(payload, fm.lastName) || 'Contact';
            phone = getDeepValue(payload, fm.phone);

            if (mapping.static_data?.tags) {
                tags = [...tags, ...mapping.static_data.tags];
            }
        } else {
            // Fallback
            email = payload.email || payload.form_response?.answers?.find((a: any) => a.type === 'email')?.email;
            firstName = payload.firstName || payload.first_name || 'New';
            lastName = payload.lastName || payload.last_name || 'Contact';
            phone = payload.phone || payload.phoneNumber;
        }

        if (!email) {
            return NextResponse.json({ error: 'No email found in payload' }, { status: 400 });
        }

        // 4. Call GHL API
        const ghlPayload = {
            firstName,
            lastName,
            email,
            phone,
            locationId: GHL_Location,
            tags
        };

        const ghlResponse = await fetch(`${GHL_API_base}/contacts/`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${GHL_Token}`,
                'Version': '2021-07-28',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(ghlPayload)
        });

        const ghlData = await ghlResponse.json();

        // 5. Update status
        const finalStatus = ghlResponse.ok ? 'processed' : 'failed';
        if (logData) {
            await supabase
                .from('zap_incoming_webhooks')
                .update({ status: finalStatus })
                .eq('id', logData.id);
        }

        if (!ghlResponse.ok) {
            console.error('GHL API Error:', ghlData);
            return NextResponse.json({ success: false, error: ghlData }, { status: ghlResponse.status });
        }

        return NextResponse.json({
            success: true,
            ghl_contact_id: ghlData.contact?.id
        });

    } catch (error: any) {
        console.error('Webhook Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

function getDeepValue(obj: any, path: string) {
    if (!path) return undefined;
    const parts = path.split('.');
    let current = obj;
    for (const part of parts) {
        if (current === null || current === undefined) return undefined;
        current = current[part];
    }
    return current;
}
