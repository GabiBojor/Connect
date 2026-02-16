const fs = require('fs');

const inputPath = '/Users/bojor/.gemini/antigravity/brain/54ad07e2-4b24-4d7c-8871-9c51402b0006/.system_generated/steps/145/output.txt';
const outputPath = '/Users/bojor/Downloads/Zapier Alternative/ghl_prezent_contacts.csv';

try {
    const content = fs.readFileSync(inputPath, 'utf8');
    const data = JSON.parse(content);

    if (!data.success || !data.data.contacts) {
        console.error('Invalid data format');
        process.exit(1);
    }

    const contacts = data.data.contacts;
    console.log(`Processing ${contacts.length} contacts...`);

    const headers = ['First Name', 'Last Name', 'Email', 'Phone', 'Tags'];
    const rows = contacts.map(c => {
        return [
            c.firstNameRaw || c.firstName || '',
            c.lastNameRaw || c.lastName || '',
            c.email || '',
            c.phone || '',
            (c.tags || []).join('; ')
        ].map(field => `"${(field || '').toString().replace(/"/g, '""')}"`).join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    fs.writeFileSync(outputPath, csvContent);
    console.log(`Success! CSV saved to ${outputPath}`);
} catch (err) {
    console.error('Error:', err);
}
