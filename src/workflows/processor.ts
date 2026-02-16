import { mapTypeformToGhl } from "../utils/mapper.js";
import { withRetry } from "../utils/retry.js";
import { GHLTools } from "../tools/ghl.js";
import { ZoomTools } from "../tools/zoom.js";

interface WebhookRecord {
    id: string;
    source: string;
    payload: any;
    status: string;
}

/**
 * Process a single webhook record.
 * This simulates the logic that would run in a background worker or Edge Function.
 */
export async function processWebhook(record: WebhookRecord) {
    console.log(`Processing Webhook ${record.id} from ${record.source}...`);

    try {
        if (record.source === "typeform") {
            await processTypeform(record.payload);
        } else if (record.source === "zoom") {
            await processZoom(record.payload);
        } else {
            console.warn(`Unknown source: ${record.source}`);
        }
    } catch (error: any) {
        console.error(`Failed to process webhook ${record.id}:`, error);
        // In a real DB worker, you would update status = 'failed' here
        throw error;
    }
}

async function processTypeform(payload: any) {
    // 1. Map Data
    const ghlContact = mapTypeformToGhl(payload);
    console.log("Mapped Contact:", ghlContact);

    // 2. Create Contact in GHL (with Retry)
    await withRetry(async () => {
        await GHLTools.create_contact.handler(ghlContact);
    });

    // 3. Business Logic: High Interest -> Hot Lead
    // Check mapped custom field or raw payload answer
    const interest = ghlContact.customFields?.['interest'] || "";

    if (interest.toLowerCase() === "high") {
        console.log("High interest detected! Adding 'Hot Lead' tag.");

        // We need a contact ID. In a real scenario, create_contact returns an ID.
        // Here we simulate it with a dummy ID.
        const contactId = "contact_123_simulated";

        await withRetry(async () => {
            await GHLTools.add_tag.handler({
                contactId,
                tags: ["Hot Lead"]
            });
        });
    }
}

async function processZoom(payload: any) {
    const participant = payload.payload?.object?.participant;
    const meetingId = payload.payload?.object?.id;

    if (!participant || !participant.email) {
        console.warn("Invalid Zoom payload: Missing participant email");
        return;
    }

    console.log(`Processing Zoom participant: ${participant.email} for meeting ${meetingId}`);

    // 1. Check if contact exists (Simulated check)
    // In reality: await GHL.lookupContact(email)
    const contactExists = Math.random() > 0.5; // Simulate 50/50 chance
    let contactId = "contact_zoom_simulated";

    if (contactExists) {
        console.log("Contact exists in GHL.");
    } else {
        console.log("Contact does not exist. Creating new contact...");
        await withRetry(async () => {
            await GHLTools.create_contact.handler({
                email: participant.email,
                firstName: participant.user_name?.split(' ')[0] || 'Zoom User',
                lastName: participant.user_name?.split(' ').slice(1).join(' ') || ''
            });
        });
    }

    // 2. Create Opportunity
    await withRetry(async () => {
        await GHLTools.create_opportunity.handler({
            contactId,
            pipelineId: "pipeline_sales",
            stageId: "stage_new_lead",
            title: `Zoom Meeting: ${payload.payload?.object?.topic || meetingId}`,
            status: "open"
        });
    });
}
