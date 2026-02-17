
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
    'https://ptsgcczbwxlcudkdmpgc.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDY0NTE1NywiZXhwIjoyMDg2MjIxMTU3fQ.XGOen7JBK9N1lgslY6yOxGbLwGd7ptXqwKQT0oYtmLc'
);

(async () => {
    try {
        console.log('Fetching latest webhooks...');
        const { data: webhooks, error: whError } = await supabase
            .from('zap_incoming_webhooks')
            .select('id, status, notes, created_at, source')
            .order('created_at', { ascending: false })
            .limit(3);

        if (whError) {
            console.error('Error fetching webhooks:', whError);
            return;
        }

        console.log('--- Latest Webhooks ---');
        webhooks.forEach(w => {
            console.log(`[${w.created_at}] Status: ${w.status}, Source: ${w.source}`);
            if (w.notes) console.log('Notes:', w.notes);
        });

        if (webhooks && webhooks.length > 0) {
            const source = webhooks[0].source;
            console.log(`\nFetching mapping for source: ${source}...`);

            const { data: mapping, error: mapError } = await supabase
                .from('zap_mappings')
                .select('*')
                .eq('source_key', source)
                .maybeSingle(); // Removed .eq('is_active', true) to check if it exists at all

            if (mapError) {
                console.error('Error fetching mapping:', mapError);
            } else if (mapping) {
                console.log('--- Active Mapping ---');
                console.log('Name:', mapping.name);
                console.log('Is Active:', mapping.is_active);
                console.log('Static Data:', JSON.stringify(mapping.static_data, null, 2));
            } else {
                console.log('No mapping found for source:', source);
            }
        }
    } catch (e) {
        console.error('Script error:', e);
    }
})();
