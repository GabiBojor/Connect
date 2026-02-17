
// Script to test the webhook locally
// Run with: node test-local-webhook.js

// const fetch = require('node-fetch'); // Native fetch is available in Node 18+

const payload = {
    "event_id": "01KHNHAJ8F4WEBRNH65MYP4MY5",
    "event_type": "form_response",
    "form_response": {
        "token": "p0nng4f487dz1zxluhkp0nngnnf7r1jp",
        "ending": {
            "id": "DefaultTyScreen",
            "ref": "default_tys"
        },
        "answers": [
            {
                "text": "TestOPP",
                "type": "text",
                "field": {
                    "id": "26DjpQz5L2GH",
                    "ref": "aee63e56-c7eb-485c-876c-be2bf97b92a0",
                    "type": "short_text"
                },
                "answer_url": "https://admin.typeform.com/form/zYV3vHPq/results?responseId=p0nng4f487dz1zxluhkp0nngnnf7r1jp&fieldId=26DjpQz5L2GH#responses"
            },
            {
                "text": "Oppw",
                "type": "text",
                "field": {
                    "id": "oT4BoKouMzbM",
                    "ref": "82633d33-7d3a-4451-bb53-07ab24ea6e32",
                    "type": "short_text"
                },
                "answer_url": "https://admin.typeform.com/form/zYV3vHPq/results?responseId=p0nng4f487dz1zxluhkp0nngnnf7r1jp&fieldId=oT4BoKouMzbM#responses"
            },
            {
                "type": "phone_number",
                "field": {
                    "id": "f2fUqsdkU0JB",
                    "ref": "1cd3f171-58b7-437e-92dc-d960c4f387bb",
                    "type": "phone_number"
                },
                "answer_url": "https://admin.typeform.com/form/zYV3vHPq/results?responseId=p0nng4f487dz1zxluhkp0nngnnf7r1jp&fieldId=f2fUqsdkU0JB#responses",
                "phone_number": "+40700022222"
            },
            {
                "type": "email",
                "email": "tesop@test.ro",
                "field": {
                    "id": "1Smm8avGvfLS",
                    "ref": "29023630-d816-43a1-bae8-4d1975a106cb",
                    "type": "email"
                },
                "answer_url": "https://admin.typeform.com/form/zYV3vHPq/results?responseId=p0nng4f487dz1zxluhkp0nngnnf7r1jp&fieldId=1Smm8avGvfLS#responses"
            }
        ],
        "form_id": "zYV3vHPq",
        "landed_at": "2026-02-17T10:11:04Z",
        "definition": {
            "id": "zYV3vHPq",
            "title": "DEV TEST - DO NOT USE!",
            "fields": [
                {
                    "id": "26DjpQz5L2GH",
                    "ref": "aee63e56-c7eb-485c-876c-be2bf97b92a0",
                    "type": "short_text",
                    "title": "First name",
                    "properties": {}
                },
                {
                    "id": "oT4BoKouMzbM",
                    "ref": "82633d33-7d3a-4451-bb53-07ab24ea6e32",
                    "type": "short_text",
                    "title": "Last name",
                    "properties": {}
                },
                {
                    "id": "f2fUqsdkU0JB",
                    "ref": "1cd3f171-58b7-437e-92dc-d960c4f387bb",
                    "type": "phone_number",
                    "title": "Phone number",
                    "properties": {}
                },
                {
                    "id": "1Smm8avGvfLS",
                    "ref": "29023630-d816-43a1-bae8-4d1975a106cb",
                    "type": "email",
                    "title": "Email",
                    "properties": {}
                }
            ],
            "endings": [
                {
                    "id": "DefaultTyScreen",
                    "ref": "default_tys",
                    "type": "thankyou_screen",
                    "title": "Thanks for completing this typeform\nNow *create your own* — it's free, easy, & beautiful",
                    "attachment": {
                        "href": "https://public-assets.typeform.com/public/admin/2dpnUBBkz2VN.gif",
                        "type": "image"
                    },
                    "properties": {
                        "button_mode": "default_redirect",
                        "button_text": "Create a *typeform*",
                        "share_icons": false,
                        "show_button": true
                    }
                }
            ],
            "settings": {
                "partial_responses_to_all_integrations": true
            }
        },
        "response_url": "https://admin.typeform.com/form/zYV3vHPq/results?responseId=p0nng4f487dz1zxluhkp0nngnnf7r1jp#responses",
        "submitted_at": "2026-02-17T10:11:22Z"
    }
};

// !!! IMPORTANT: Replace this with your actual source key from the dashboard !!!
const SOURCE_KEY = 'trigger_kw1lxv';

(async () => {
    try {
        console.log(`Sending webhook to localhost:3000/api/webhook?source=${SOURCE_KEY}...`);
        const response = await fetch(`http://localhost:3000/api/webhook?source=${SOURCE_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        console.log('Response Status:', response.status);
        console.log('Response Data:', JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Error sending webhook:', error);
    }
})();
