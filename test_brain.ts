import { processWebhook } from "./src/workflows/processor";
import { GHLTools } from "./src/tools/ghl";

// Mock Data for Testing
// 1. Typeform with HIGH interest
const mockTypeformHigh = {
    id: "wh_tf_high",
    source: "typeform",
    status: "pending",
    payload: {
        form_response: {
            answers: [
                { type: "text", text: "High Roller", field: { id: "name_field", ref: "name_ref" } },
                { type: "email", email: "high@roller.com", field: { id: "email_ref" } },
                { type: "text", text: "High", field: { id: "interest_field", ref: "interest_ref" } }
            ]
        }
    }
};

// 2. Typeform with LOW interest
const mockTypeformLow = {
    id: "wh_tf_low",
    source: "typeform",
    status: "pending",
    payload: {
        form_response: {
            answers: [
                { type: "text", text: "Low Rider", field: { id: "name_field" } },
                { type: "email", email: "low@rider.com", field: { id: "email_ref" } },
                { type: "text", text: "Low", field: { id: "interest_field" } }
            ]
        }
    }
};

// 3. Zoom
const mockZoom = {
    id: "wh_zm_1",
    source: "zoom",
    status: "pending",
    payload: {
        payload: {
            object: {
                id: "meeting_999",
                topic: "Demo Call",
                participant: {
                    user_name: "Bob Builder",
                    email: "bob@example.com"
                }
            }
        }
    }
};

async function runTest() {
    console.log("=== TEST 1: Typeform High Interest ===");
    console.log("Expect: Create Contact + Add Tag 'Hot Lead'");
    await processWebhook(mockTypeformHigh);

    console.log("\n=== TEST 2: Typeform Low Interest ===");
    console.log("Expect: Create Contact ONLY");
    await processWebhook(mockTypeformLow);

    console.log("\n=== TEST 3: Zoom ===");
    console.log("Expect: Check Exists + Create Opportunity");
    await processWebhook(mockZoom);
}

runTest().catch(console.error);
