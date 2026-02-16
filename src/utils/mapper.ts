/**
 * Maps Typeform webhook payload to a flat GHL contact object.
 * @param payload The raw Typeform payload.
 */
export function mapTypeformToGhl(payload: any): any {
    const formResponse = payload?.form_response;
    if (!formResponse || !formResponse.answers) {
        throw new Error("Invalid Typeform payload: Missing form_response or answers");
    }

    const ghlContact: any = {
        customFields: {},
        tags: []
    };

    // Iterate through answers
    for (const answer of formResponse.answers) {
        // Basic mapping based on field type or ref/id
        // In a real scenario, you usually map by 'field.ref' or 'field.id' which are stable IDs from Typeform

        // Example: Name
        if (answer.type === 'text' && (answer.field.ref?.includes('name') || answer.field.id === 'name_field')) {
            const parts = answer.text.split(' ');
            ghlContact.firstName = parts[0];
            ghlContact.lastName = parts.slice(1).join(' ');
        }

        // Example: Email
        if (answer.type === 'email') {
            ghlContact.email = answer.email;
        }

        // Example: Phone
        if (answer.type === 'phone_number') {
            ghlContact.phone = answer.phone_number;
        }

        // Example: "Interes" custom field
        // Assuming field ref or id indicates interest
        if (answer.field.ref?.includes('interest') || answer.field.id === 'interest_field') {
            // For Choice questions
            if (answer.type === 'choice') {
                ghlContact.customFields['interest'] = answer.choice.label;
            }
            // For Text questions
            if (answer.type === 'text') {
                ghlContact.customFields['interest'] = answer.text;
            }
        }
    }

    return ghlContact;
}
