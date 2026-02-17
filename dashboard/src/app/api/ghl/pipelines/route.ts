import { NextResponse } from 'next/server';

const GHL_API_base = 'https://services.leadconnectorhq.com';
const GHL_Token = process.env.GHL_PIT_TOKEN;
const GHL_Location = process.env.GHL_LOCATION_ID;

export async function GET() {
    try {
        if (!GHL_Token || !GHL_Location) {
            return NextResponse.json({ error: 'Missing GHL Configuration' }, { status: 500 });
        }

        const response = await fetch(`${GHL_API_base}/opportunities/pipelines?locationId=${GHL_Location}`, {
            headers: {
                'Authorization': `Bearer ${GHL_Token}`,
                'Version': '2021-07-28',
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('GHL Pipelines Error:', errorData);
            return NextResponse.json({ error: 'Failed to fetch pipelines', details: errorData }, { status: response.status });
        }

        const data = await response.json();
        return NextResponse.json(data);

    } catch (error: any) {
        console.error('API Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
