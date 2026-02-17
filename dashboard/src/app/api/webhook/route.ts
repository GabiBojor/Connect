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

export async function POST(req: Request) {
    let logData: any = null;

    try {
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

        // Auto-identify source if it's a Zoom Webinar registration
        let sourceKey = searchParams.get('source');

        if (!sourceKey && payload.event === 'webinar.registration_created' && payload.payload?.object?.id) {
            sourceKey = `zoom_webinar_${payload.payload.object.id}`;
        }

        if (!sourceKey && payload.event === 'meeting.registration_created' && payload.payload?.object?.id) {
            sourceKey = `zoom_meeting_${payload.payload.object.id}`;
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

        // 2. Log to Supabase
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
            throw new Error('No email found in payload');
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
                .update({
                    status: finalStatus,
                    notes: !ghlResponse.ok ? JSON.stringify(ghlData) : null
                })
                .eq('id', logData.id);
        }

        let contactId = ghlData.contact?.id;

        if (!ghlResponse.ok) {
            // Handle duplicate contact error gracefully
            if (ghlResponse.status === 400 && ghlData.message === "This location does not allow duplicated contacts.") {
                contactId = ghlData.meta?.contactId;
                console.log('Duplicate contact found, updating existing ID:', contactId);

                // Update existing contact to add new tags/info
                await fetch(`${GHL_API_base}/contacts/${contactId}`, {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${GHL_Token}`,
                        'Version': '2021-07-28',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(ghlPayload)
                });
            } else {
                console.error('GHL API Error:', ghlData);
                return NextResponse.json({ success: false, error: ghlData }, { status: ghlResponse.status });
            }
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
                let opportunityError = null;

                console.log('Attempting Opportunity operation for pipeline:', mapping.static_data.pipeline_id);

                let oppResponse = await fetch(`${GHL_API_base}/opportunities/`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${GHL_Token}`,
                        'Version': '2021-07-28',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(oppPayload)
                });

                // If opportunity already exists, we search and update it
                if (!oppResponse.ok) {
                    const errorData = await oppResponse.clone().json();
                    if (oppResponse.status === 400 && errorData.message === "Can not create duplicate opportunity for the contact.") {
                        console.log('Duplicate opportunity found, searching to update...');

                        const searchRes = await fetch(`${GHL_API_base}/opportunities/search?contact_id=${contactId}&location_id=${GHL_Location}`, {
                            headers: {
                                'Authorization': `Bearer ${GHL_Token}`,
                                'Version': '2021-07-28'
                            }
                        });

                        const searchData = await searchRes.json();
                        const existingOpp = searchData.opportunities?.find((o: any) => o.pipelineId === mapping.static_data.pipeline_id);

                        if (existingOpp) {
                            console.log('Updating existing opportunity:', existingOpp.id);
                            oppResponse = await fetch(`${GHL_API_base}/opportunities/${existingOpp.id}`, {
                                method: 'PUT',
                                headers: {
                                    'Authorization': `Bearer ${GHL_Token}`,
                                    'Version': '2021-07-28',
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({
                                    pipelineStageId: mapping.static_data.stage_id,
                                    name: name,
                                    monetaryValue: monetaryValue
                                })
                            });
                        }
                    }
                }

                if (!oppResponse.ok) {
                    opportunityError = await oppResponse.json();
                    opportunityStatus = 'failed';
                    console.error('Opportunity Creation/Update Error:', opportunityError);
                    if (logData) {
                        await supabase
                            .from('zap_incoming_webhooks')
                            .update({
                                notes: JSON.stringify({ contact: ghlData, opportunityError: opportunityError }),
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
                                notes: JSON.stringify({ contact: ghlData, opportunity: 'processed' })
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
            }
        } else {
            // If not an opportunity action, mark as processed (contact created/updated)
            if (logData) {
                await supabase
                    .from('zap_incoming_webhooks')
                    .update({
                        status: 'processed',
                        notes: JSON.stringify({ contact: ghlData })
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
