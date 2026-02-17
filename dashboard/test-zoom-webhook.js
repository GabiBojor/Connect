
// Script to simulate a Zoom registration webhook locally
// Run with: node test-zoom-webhook.js <MEETING_OR_WEBINAR_ID>

const id = process.argv.slice(2).join('').replace(/\s/g, '');

if (!id) {
    console.error("Please provide a Meeting or Webinar ID!");
    console.log("Example: node test-zoom-webhook.js 84741921460");
    process.exit(1);
}

const payload = {
    "event": "meeting.registration_created",
    "event_ts": Date.now(),
    "payload": {
        "account_id": "test_account",
        "object": {
            "id": id,
            "uuid": "test_uuid",
            "host_id": "test_host",
            "topic": "DEV MEETING TEST",
            "type": 2,
            "start_time": "2026-02-18T10:00:00Z",
            "timezone": "Europe/Bucharest",
            "registrant": {
                "id": "test_reg_id",
                "email": "test.user@example.com",
                "first_name": "Test",
                "last_name": "Zoom User",
                "phone": "+40722000000",
                "address": "Strada Test 1",
                "city": "Bucharest",
                "country": "RO",
                "zip": "123456",
                "create_time": new Date().toISOString()
            }
        }
    }
};

(async () => {
    try {
        console.log(`Simulating Zoom Webhook for ID: ${id}...`);
        const response = await fetch(`http://localhost:3000/api/webhook`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        console.log('Response Status:', response.status);
        console.log('Response Debug:', JSON.stringify(data.debug, null, 2));
    } catch (error) {
        console.error('Error sending webhook:', error);
    }
})();
