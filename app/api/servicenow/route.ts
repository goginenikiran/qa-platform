import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
    try {
        const { instanceUrl, username, password, incidentNumber } = await req.json();

        if (!instanceUrl || !username || !password || !incidentNumber) {
            return NextResponse.json(
                { error: 'Missing required fields: instanceUrl, username, password, incidentNumber' },
                { status: 400 }
            );
        }

        const auth = Buffer.from(`${username}:${password}`).toString('base64');
        const url = `${instanceUrl.replace(/\/$/, '')}/api/now/table/incident?sysparm_query=number=${encodeURIComponent(incidentNumber)}&sysparm_limit=1`;

        const res = await fetch(url, {
            headers: {
                Authorization: `Basic ${auth}`,
                Accept: 'application/json',
                'Content-Type': 'application/json',
            },
        });

        if (!res.ok) {
            const errorText = await res.text().catch(() => '');
            return NextResponse.json(
                { error: `ServiceNow returned ${res.status}: ${errorText.slice(0, 200) || res.statusText}` },
                { status: res.status }
            );
        }

        const json = await res.json();
        const result = json.result;

        if (!result || result.length === 0) {
            return NextResponse.json(
                { error: `Incident "${incidentNumber}" not found. Check the incident number and try again.` },
                { status: 404 }
            );
        }

        const inc = result[0];
        const incident = {
            sys_id: inc.sys_id,
            number: inc.number || incidentNumber,
            title: inc.short_description || 'Untitled',
            description: inc.description || '',
            state: inc.state,
            priority: inc.priority,
            assignment_group: inc.assignment_group?.display_value || '',
            assigned_to: inc.assigned_to?.display_value || '',
            category: inc.category || '',
            subcategory: inc.subcategory || '',
            impact: inc.impact || '',
            urgency: inc.urgency || '',
            sys_created_on: inc.sys_created_on || '',
            sys_updated_on: inc.sys_updated_on || '',
        };

        return NextResponse.json({ incident });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to fetch from ServiceNow';
        console.error('[ServiceNow Incident Error]', message);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
