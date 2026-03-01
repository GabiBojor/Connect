import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// Supabase setup for server-side
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// GHL API Constants
const GHL_API_base = 'https://services.leadconnectorhq.com';
const GHL_Token = process.env.GHL_API_KEY;
const GHL_Location = process.env.GHL_LOCATION_ID;
const ZOOM_WEBHOOK_SECRET = process.env.ZOOM_WEBHOOK_SECRET;

// Rate limiting: 60 requests per minute per IP
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 60;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;

function isRateLimited(ip: string): boolean {
    const now = Date.now();
    const entry = rateLimitMap.get(ip);
    if (!entry || now > entry.resetAt) {
        rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
        return false;
    }
    entry.count++;
    return entry.count > RATE_LIMIT_MAX;
}

// Helper to safely call GHL API and return structured result
async function ghlFetch(url: string, options: RequestInit, context: string): Promise<{ ok: boolean; status: number; data: any; error?: string }> {
    try {
        const response = await fetch(url, options);
        let data: any;
        try {
            data = await response.json();
        } catch {
            data = null;
        }
        if (!response.ok) {
            return {
                ok: false,
                status: response.status,
                data,
                error: `GHL ${context} failed (${response.status}): ${data?.message || data?.msg || JSON.stringify(data)}`
            };
        }
        return { ok: true, status: response.status, data };
    } catch (err: any) {
        return { ok: false, status: 0, data: null, error: `GHL ${context} network error: ${err.message}` };
    }
}

export async function POST(req: Request) {
    let logData: any = null;

    try {
        // Rate limiting
        const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown';
        if (isRateLimited(ip)) {
            return NextResponse.json({ error: 'Rate limit exceeded. Max 60 requests per minute.' }, { status: 429 });
        }

        const { searchParams } = new URL(req.url);
        const payload = await req.json();

        // 0. Handle Zoom Webhook Validation challenge
        if (payload.event === 'endpoint.url_validation') {
            const plainToken = payload.payload?.plainToken;
            if (plainToken && ZOOM_WEBHOOK_SECRET) {
                const encryptedToken = crypto
                    .createHmac('sha256', ZOOM_WEBHOOK_SECRET)
                    .update(plainToken)
                    .digest('hex');

                console.log('--- Zoom Webhook Validation Success ---');
                return NextResponse.json({
                    plainToken,
                    encryptedToken
                }, { status: 200 });
            }
        }

        // Filter out Zoom events that don't contain actionable data (no email)
        const ignoredZoomEvents = [
            'meeting.started', 'meeting.ended',
            'meeting.participant_jbh_waiting', 'meeting.participant_jbh_joined',
            'meeting.participant_left'
        ];
        if (ignoredZoomEvents.includes(payload.event)) {
            return NextResponse.json({ success: true, skipped: true, reason: 'Event type not actionable' });
        }

        // Auto-identify source if it's a Zoom Webinar/Meeting event
        let sourceKey = searchParams.get('source');
        const zoomEvent = payload.event;
        const zoomId = payload.payload?.object?.id;

        if (!sourceKey && zoomId) {
            if (zoomEvent?.startsWith('webinar.')) {
                sourceKey = `zoom_webinar_${zoomId}`;
            } else if (zoomEvent?.startsWith('meeting.')) {
                sourceKey = `zoom_meeting_${zoomId}`;
            }
        }

        if (!sourceKey) {
            sourceKey = payload.source || 'generic_webhook';
        }

        console.log(`--- Incoming Webhook [${sourceKey}] ---`);

        // 1. Fetch Mapping Rules
        const { data: mapping } = await supabase
            .from('zap_mappings')
            .select('*')
            .eq('source_key', sourceKey)
            .eq('is_active', true)
            .maybeSingle();

        // 2. Log to Supabase (or reuse existing log if this is a retry)
        const retryOfId = searchParams.get('retry_of');

        if (retryOfId) {
            // This is a retry — update the existing log instead of creating a new one
            const { data: existingLog } = await supabase
                .from('zap_incoming_webhooks')
                .update({ status: 'processing', notes: null })
                .eq('id', retryOfId)
                .select()
                .single();
            logData = existingLog;
        } else {
            const { data: insertedLog, error: dbError } = await supabase
                .from('zap_incoming_webhooks')
                .insert({
                    source: sourceKey,
                    payload: payload,
                    status: 'processing'
                })
                .select()
                .single();

            logData = insertedLog;
            if (dbError) console.error('Supabase Log Error:', dbError);
        }

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

            // Zoom fallback: if mapped path didn't find email, try alternate Zoom paths
            if (!email && payload.payload?.object) {
                email = payload.payload.object.participant?.email || payload.payload.object.registrant?.email;
                const fallbackName = payload.payload.object.participant?.user_name ||
                    `${payload.payload.object.registrant?.first_name || ''} ${payload.payload.object.registrant?.last_name || ''}`.trim();
                if (fallbackName && firstName === 'New') firstName = fallbackName;
                phone = phone || payload.payload.object.participant?.phone || payload.payload.object.registrant?.phone;
            }

            // Split full name if lastName is empty (e.g. Zoom participant has user_name but no separate first/last)
            if (!lastName || lastName === 'Contact') {
                const nameParts = (firstName || '').trim().split(/\s+/);
                if (nameParts.length > 1) {
                    firstName = nameParts[0];
                    lastName = nameParts.slice(1).join(' ');
                }
            }

            if (mapping.static_data?.tags) {
                tags = [...tags, ...mapping.static_data.tags];
            }
        } else {
            // Fallback - Expanded for Zoom and other nested structures
            email = payload.email ||
                payload.payload?.object?.participant?.email ||
                payload.payload?.object?.registrant?.email ||
                payload.form_response?.answers?.find((a: any) => a.type === 'email')?.email;

            phone = payload.phone || payload.phoneNumber ||
                payload.payload?.object?.participant?.phone ||
                payload.payload?.object?.registrant?.phone;

            const rawFirstName = payload.firstName || payload.first_name || payload.payload?.object?.participant?.first_name;
            const rawLastName = payload.lastName || payload.last_name || payload.payload?.object?.participant?.last_name;
            const fullName = payload.payload?.object?.participant?.user_name;

            if (rawFirstName) {
                firstName = rawFirstName;
                lastName = rawLastName || 'Contact';
            } else if (fullName) {
                const parts = fullName.trim().split(/\s+/);
                firstName = parts[0];
                lastName = parts.slice(1).join(' ') || 'Contact';
            }

            phone = payload.phone || payload.phoneNumber || payload.payload?.object?.participant?.phone;
        }

        if (!email) {
            throw new Error('No email found in payload');
        }

        // 4. Call GHL API - Create Contact
        const ghlPayload = {
            firstName,
            lastName,
            email,
            phone,
            locationId: GHL_Location,
            tags
        };

        const ghlHeaders = {
            'Authorization': `Bearer ${GHL_Token}`,
            'Version': '2021-07-28',
            'Content-Type': 'application/json'
        };

        const ghlResult = await ghlFetch(`${GHL_API_base}/contacts/`, {
            method: 'POST',
            headers: ghlHeaders,
            body: JSON.stringify(ghlPayload)
        }, 'Create Contact');

        const errors: string[] = [];
        let contactId = ghlResult.data?.contact?.id;

        if (!ghlResult.ok) {
            // Handle duplicate contact error gracefully
            if (ghlResult.status === 400 && ghlResult.data?.message === "This location does not allow duplicated contacts.") {
                contactId = ghlResult.data?.meta?.contactId;

                if (!contactId) {
                    const errMsg = 'Duplicate contact detected but GHL did not return contactId';
                    errors.push(errMsg);
                    console.error(errMsg);
                } else {
                    console.log('Duplicate contact found, updating existing ID:', contactId);

                    // Update existing contact info
                    const updateResult = await ghlFetch(`${GHL_API_base}/contacts/${contactId}`, {
                        method: 'PUT',
                        headers: ghlHeaders,
                        body: JSON.stringify({ firstName, lastName, phone, locationId: GHL_Location })
                    }, 'Update Contact');

                    if (!updateResult.ok) {
                        errors.push(updateResult.error!);
                    }

                    // Add tags via separate endpoint (PUT doesn't update tags)
                    if (tags.length > 0) {
                        const tagResult = await ghlFetch(`${GHL_API_base}/contacts/${contactId}/tags`, {
                            method: 'POST',
                            headers: ghlHeaders,
                            body: JSON.stringify({ tags })
                        }, 'Add Tags');

                        if (!tagResult.ok) {
                            errors.push(tagResult.error!);
                        }
                    }
                }
            } else {
                const errMsg = ghlResult.error || 'Unknown GHL error';
                errors.push(errMsg);
                console.error('GHL API Error:', errMsg);

                if (logData) {
                    await supabase
                        .from('zap_incoming_webhooks')
                        .update({
                            status: 'failed',
                            notes: JSON.stringify({ error: errMsg, ghl_status: ghlResult.status, ghl_response: ghlResult.data })
                        })
                        .eq('id', logData.id);
                }

                return NextResponse.json({ success: false, error: errMsg }, { status: ghlResult.status || 500 });
            }
        }

        if (!contactId) {
            const errMsg = 'No contact ID returned from GHL after create/update';
            errors.push(errMsg);
            console.error(errMsg);
        }

        // 5. Handle Opportunity Action
        console.log('Checking Opportunity Action:', {
            actionType: mapping?.static_data?.action_type,
            staticData: mapping?.static_data
        });

        if (mapping?.static_data?.action_type === 'opportunity') {
            if (contactId) {
                const fm = mapping.field_map || {};
                const oppNameInput = fm.opportunityName || mapping.static_data.opportunity_name;
                const oppValueInput = fm.opportunityCents || mapping.static_data.monetary_value;

                let name = getDeepValue(payload, oppNameInput) || oppNameInput || 'New Deal';
                name = name.replace('{{name}}', `${firstName} ${lastName}`);
                let monetaryValue = Number(getDeepValue(payload, oppValueInput) || oppValueInput || 0);
                if (isNaN(monetaryValue)) monetaryValue = 0;

                if (!mapping.static_data.pipeline_id || !mapping.static_data.stage_id) {
                    throw new Error('Missing Pipeline ID or Stage ID for Opportunity');
                }

                const oppPayload = {
                    pipelineId: mapping.static_data.pipeline_id,
                    locationId: GHL_Location,
                    name: name,
                    status: "open",
                    pipelineStageId: mapping.static_data.stage_id,
                    monetaryValue: monetaryValue,
                    contactId: contactId
                };

                let opportunityStatus = 'not_attempted';
                let opportunityError: string | null = null;

                console.log('Attempting Opportunity operation for pipeline:', mapping.static_data.pipeline_id);

                const oppResult = await ghlFetch(`${GHL_API_base}/opportunities/`, {
                    method: 'POST',
                    headers: ghlHeaders,
                    body: JSON.stringify(oppPayload)
                }, 'Create Opportunity');

                let oppFinalOk = oppResult.ok;

                // If opportunity already exists, we search and update it
                if (!oppResult.ok) {
                    if (oppResult.status === 400 && oppResult.data?.message === "Can not create duplicate opportunity for the contact.") {
                        console.log('Duplicate opportunity found, searching to update...');

                        const searchResult = await ghlFetch(
                            `${GHL_API_base}/opportunities/search?contact_id=${contactId}&location_id=${GHL_Location}`,
                            { headers: ghlHeaders },
                            'Search Opportunities'
                        );

                        if (!searchResult.ok) {
                            opportunityError = searchResult.error || 'Failed to search existing opportunities';
                        } else {
                            const existingOpp = searchResult.data?.opportunities?.find((o: any) => o.pipelineId === mapping.static_data.pipeline_id);

                            if (existingOpp) {
                                console.log('Updating existing opportunity:', existingOpp.id);
                                const updateOppResult = await ghlFetch(`${GHL_API_base}/opportunities/${existingOpp.id}`, {
                                    method: 'PUT',
                                    headers: ghlHeaders,
                                    body: JSON.stringify({
                                        pipelineStageId: mapping.static_data.stage_id,
                                        name: name,
                                        monetaryValue: monetaryValue
                                    })
                                }, 'Update Opportunity');

                                oppFinalOk = updateOppResult.ok;
                                if (!updateOppResult.ok) {
                                    opportunityError = updateOppResult.error || 'Failed to update existing opportunity';
                                }
                            } else {
                                opportunityError = 'Duplicate opportunity detected but could not find it in search results';
                            }
                        }
                    } else {
                        opportunityError = oppResult.error || 'Unknown opportunity creation error';
                    }
                }

                if (!oppFinalOk || opportunityError) {
                    opportunityStatus = 'failed';
                    console.error('Opportunity Error:', opportunityError);
                    if (logData) {
                        await supabase
                            .from('zap_incoming_webhooks')
                            .update({
                                notes: JSON.stringify({
                                    contact: ghlResult.data,
                                    contact_warnings: errors.length > 0 ? errors : undefined,
                                    opportunity_error: opportunityError,
                                    opportunity_ghl_status: oppResult.status
                                }),
                                status: 'opportunity_failed'
                            })
                            .eq('id', logData.id);
                    }
                } else {
                    opportunityStatus = 'success';
                    console.log('Opportunity Processed Successfully');
                    if (logData) {
                        await supabase
                            .from('zap_incoming_webhooks')
                            .update({
                                status: 'processed',
                                notes: JSON.stringify({
                                    contact: ghlResult.data,
                                    contact_warnings: errors.length > 0 ? errors : undefined,
                                    opportunity: 'processed'
                                })
                            })
                            .eq('id', logData.id);
                    }
                }

                return NextResponse.json({
                    success: true,
                    ghl_contact_id: contactId,
                    debug: {
                        mapping_name: mapping?.name,
                        action_type: mapping?.static_data?.action_type,
                        pipeline_id: mapping?.static_data?.pipeline_id,
                        stage_id: mapping?.static_data?.stage_id,
                        contact_created: !!contactId,
                        opportunity_attempted: true,
                        opportunity_status: opportunityStatus,
                        opportunity_error: opportunityError
                    }
                });
            } else {
                console.warn('Skipping Opportunity: No Contact ID returned from GHL');
                if (logData) {
                    await supabase
                        .from('zap_incoming_webhooks')
                        .update({
                            status: 'opportunity_failed',
                            notes: JSON.stringify({
                                contact: ghlResult.data,
                                contact_warnings: errors,
                                opportunity_error: 'No Contact ID available — cannot create opportunity'
                            })
                        })
                        .eq('id', logData.id);
                }
            }
        } else {
            // If not an opportunity action, mark as processed (contact created/updated)
            if (logData) {
                await supabase
                    .from('zap_incoming_webhooks')
                    .update({
                        status: 'processed',
                        notes: JSON.stringify({ contact: ghlResult.data, contact_warnings: errors.length > 0 ? errors : undefined })
                    })
                    .eq('id', logData.id);
            }
        }

        return NextResponse.json({
            success: true,
            ghl_contact_id: contactId,
            debug: {
                mapping_name: mapping?.name,
                action_type: mapping?.static_data?.action_type,
                pipeline_id: mapping?.static_data?.pipeline_id,
                stage_id: mapping?.static_data?.stage_id,
                contact_created: !!contactId,
                opportunity_attempted: mapping?.static_data?.action_type === 'opportunity'
            }
        });

    } catch (error: any) {
        console.error('Webhook Error:', error);

        if (logData) {
            await supabase
                .from('zap_incoming_webhooks')
                .update({
                    status: 'failed',
                    notes: JSON.stringify({ error: error.message })
                })
                .eq('id', logData.id);
        }

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
