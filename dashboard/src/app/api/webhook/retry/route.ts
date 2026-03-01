import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(req: Request) {
    try {
        const { ids } = await req.json();

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return NextResponse.json({ error: 'No webhook IDs provided' }, { status: 400 });
        }

        // Fetch the failed webhooks from DB
        const { data: webhooks, error } = await supabase
            .from('zap_incoming_webhooks')
            .select('*')
            .in('id', ids)
            .in('status', ['failed', 'opportunity_failed']);

        if (error) {
            return NextResponse.json({ error: 'Failed to fetch webhooks' }, { status: 500 });
        }

        if (!webhooks || webhooks.length === 0) {
            return NextResponse.json({ error: 'No failed webhooks found for given IDs' }, { status: 404 });
        }

        const baseUrl = new URL(req.url).origin;
        const results: { id: string; status: string; error?: string }[] = [];

        for (const webhook of webhooks) {
            try {
                // Mark as retrying
                await supabase
                    .from('zap_incoming_webhooks')
                    .update({ status: 'processing', notes: null })
                    .eq('id', webhook.id);

                // Re-send the original payload to the webhook endpoint
                const params = new URLSearchParams();
                if (webhook.source !== 'generic_webhook') params.set('source', webhook.source);
                params.set('retry_of', webhook.id);
                const queryStr = params.toString() ? `?${params.toString()}` : '';
                const response = await fetch(`${baseUrl}/api/webhook${queryStr}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(webhook.payload),
                });

                const data = await response.json();

                // The webhook handler updates the log directly via retry_of param,
                // so we just report the result here without overwriting.
                if (response.ok && data.success) {
                    results.push({ id: webhook.id, status: 'retried' });
                } else {
                    results.push({ id: webhook.id, status: 'failed', error: data.error || 'Unknown error' });
                }
            } catch (err: any) {
                results.push({ id: webhook.id, status: 'failed', error: err.message });
            }
        }

        return NextResponse.json({ success: true, results });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
