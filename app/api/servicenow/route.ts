import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

async function callServiceNow(instanceUrl: string, username: string, password: string, endpoint: string) {
    let baseUrl = instanceUrl.trim().replace(/\/$/, '');
    if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
        baseUrl = 'https://' + baseUrl;
    }
    const auth = Buffer.from(`${username}:${password}`).toString('base64');
    const url = `${baseUrl}${endpoint}`;

    const res = await fetch(url, {
        headers: {
            Authorization: `Basic ${auth}`,
            Accept: 'application/json',
        },
        signal: AbortSignal.timeout(15000),
    });

    const bodyText = await res.text();
    return { status: res.status, body: bodyText, ok: res.ok };
}

export async function POST(req: NextRequest) {
    try {
        const { instanceUrl, username, password, incidentNumber, action } = await req.json();

        if (!instanceUrl || !username || !password) {
            return NextResponse.json(
                { error: 'Missing required fields: instanceUrl, username, password' },
                { status: 400 }
            );
        }

        // Test connection — just try to query the user table
        if (action === 'test') {
            try {
                const result = await callServiceNow(instanceUrl, username, password, '/api/now/table/sys_user?sysparm_query=user_name=' + encodeURIComponent(username) + '&sysparm_limit=1');
                if (result.ok) {
                    const json = JSON.parse(result.body);
                    const user = json.result?.[0];
                    return NextResponse.json({
                        success: true,
                        message: `Connected as ${user?.name || username}`,
                        user: user?.name || username,
                    });
                } else {
                    const parsed = JSON.parse(result.body);
                    return NextResponse.json({
                        success: false,
                        error: parsed.error?.message || `HTTP ${result.status}`,
                    });
                }
            } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : String(err);
                if (msg.includes('timeout')) {
                    return NextResponse.json({ success: false, error: 'Instance unreachable (timeout). Check the URL.' });
                }
                if (msg.includes('ENOTFOUND') || msg.includes('ECONNREFUSED')) {
                    return NextResponse.json({ success: false, error: `Cannot reach instance. Check the URL.` });
                }
                return NextResponse.json({ success: false, error: msg });
            }
        }

        // Fetch incident
        if (!incidentNumber) {
            return NextResponse.json({ error: 'incidentNumber is required' }, { status: 400 });
        }

        try {
            const result = await callServiceNow(instanceUrl, username, password,
                `/api/now/table/incident?sysparm_query=number=${encodeURIComponent(incidentNumber.trim())}&sysparm_limit=1`);

            if (!result.ok) {
                let errorMsg = `HTTP ${result.status}`;
                try {
                    const parsed = JSON.parse(result.body);
                    errorMsg = parsed.error?.message || errorMsg;
                } catch {}
                return NextResponse.json({ error: errorMsg }, { status: result.status });
            }

            const json = JSON.parse(result.body);
            const inc = json.result?.[0];

            if (!inc) {
                return NextResponse.json({ error: `Incident "${incidentNumber}" not found.` }, { status: 404 });
            }

            return NextResponse.json({
                incident: {
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
                },
            });
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            if (msg.includes('timeout')) {
                return NextResponse.json({ error: 'Instance unreachable (timeout).' }, { status: 504 });
            }
            return NextResponse.json({ error: msg }, { status: 500 });
        }
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed';
        console.error('[ServiceNow Error]', message);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
