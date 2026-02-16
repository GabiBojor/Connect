import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import "https://deno.land/std@0.177.0/dotenv/load.ts";

// Configuration (Replace with your actual values for local testing or use environment variables)
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "YOUR_SUPABASE_URL";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "YOUR_SERVICE_ROLE_KEY";
const FUNCTION_URL = "http://localhost:54321/functions/v1/webhook-receiver"; // Local Supabase function URL

// Mock Payloads
const typeformPayload = {
    event_id: "evt_123",
    event_type: "form_response",
    form_response: {
        form_id: "f_456",
        answers: [
            { type: "text", text: "John Doe", field: { id: "name_field" } },
            { type: "email", email: "john@example.com", field: { id: "email_field" } }
        ]
    }
};

const zoomPayload = {
    event: "meeting.participant_joined",
    payload: {
        object: {
            id: "1234567890",
            topic: "Sales Call",
            participant: {
                user_name: "Jane Smith",
                email: "jane@example.com"
            }
        }
    }
};

async function sendWebhook(source: string, payload: any) {
    console.log(`Sending ${source} webhook...`);

    // Simulate direct DB insertion (if Function is not running)
    // const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    // const { data, error } = await supabase
    //     .from('zap_incoming_webhooks')
    //     .insert({ source, payload, status: 'pending' })
    //     .select();

    // if (error) {
    //     console.error("Error inserting to DB:", error);
    // } else {
    //     console.log("Success! Inserted:", data);
    // }

    // OR Simulate HTTP Request to Edge Function (if running locally via 'supabase start')
    try {
        const response = await fetch(`${FUNCTION_URL}?source=${source}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        const text = await response.text();
        console.log(`Response from Function: ${response.status} ${text}`);
    } catch (e: any) {
        console.error("Error calling function:", e.message);
        console.log("Make sure you operate 'supabase start' and 'supabase functions serve'");
    }
}

// Run scenarios
console.log("Starting simulation...");
await sendWebhook("typeform", typeformPayload);
await sendWebhook("zoom", zoomPayload);
