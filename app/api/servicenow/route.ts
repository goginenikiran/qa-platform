import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

async function getOAuthToken(instanceUrl: string, clientId: string, clientSecret: string) {
    let baseUrl = instanceUrl.trim().replace(/\/$/, '');
    if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
        baseUrl = 'https://' + baseUrl;
    }

    // Try multiple OAuth endpoints
    const endpoints = ['/oauth_token.do', '/oauth2/token'];
    let lastError = '';

    for (const endpoint of endpoints) {
        try {
            const res = await fetch(`${baseUrl}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: `grant_type=client_credentials&client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(clientSecret)}`,
                signal: AbortSignal.timeout(15000),
            });
            const data = await res.json();
            console.log('[ServiceNow] OAuth endpoint:', endpoint, 'Status:', res.status, 'Response:', JSON.stringify(data).substring(0, 200));

            if (res.ok && data.access_token) {
                return data.access_token;
            }
            lastError = data.error_description || data.error || `HTTP ${res.status}`;
        } catch (err: unknown) {
            lastError = err instanceof Error ? err.message : String(err);
        }
    }
    throw new Error(`OAuth token failed: ${lastError}`);
}

async function callServiceNow(instanceUrl: string, config: Record<string, string>, endpoint: string) {
    let baseUrl = instanceUrl.trim().replace(/\/$/, '');
    if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
        baseUrl = 'https://' + baseUrl;
    }
    const url = `${baseUrl}${endpoint}`;

    const headers: Record<string, string> = {
        Accept: 'application/json',
        'Content-Type': 'application/json',
    };

    if (config.authMethod === 'oauth' && config.clientId && config.clientSecret) {
        const token = await getOAuthToken(instanceUrl, config.clientId, config.clientSecret);
        headers['Authorization'] = `Bearer ${token}`;
    } else {
        const auth = Buffer.from(`${config.username}:${config.password}`).toString('base64');
        headers['Authorization'] = `Basic ${auth}`;
    }

    console.log('[ServiceNow] URL:', url);
    console.log('[ServiceNow] Auth method:', config.authMethod || 'basic');

    const res = await fetch(url, { headers, signal: AbortSignal.timeout(15000) });
    const bodyText = await res.text();
    console.log('[ServiceNow] Status:', res.status);
    console.log('[ServiceNow] Body:', bodyText.substring(0, 300));
    return { status: res.status, body: bodyText, ok: res.ok };
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { instanceUrl, username, password, incidentNumber, action, authMethod, clientId, clientSecret } = body;

        if (!instanceUrl) {
            return NextResponse.json({ error: 'Instance URL is required' }, { status: 400 });
        }

        const config: Record<string, string> = { instanceUrl, username: username || '', password: password || '', authMethod: authMethod || 'basic', clientId: clientId || '', clientSecret: clientSecret || '' };

        // Test connection
        if (action === 'test') {
            try {
                const result = await callServiceNow(instanceUrl, config, '/api/now/table/sys_user?sysparm_query=user_name=' + encodeURIComponent(username) + '&sysparm_limit=1');
                if (result.ok) {
                    const json = JSON.parse(result.body);
                    const user = json.result?.[0];
                    return NextResponse.json({ success: true, message: `Connected as ${user?.name || username}`, user: user?.name || username });
                } else {
                    let errorMsg = `HTTP ${result.status}`;
                    try { errorMsg = JSON.parse(result.body).error?.message || errorMsg; } catch {}
                    return NextResponse.json({ success: false, error: errorMsg });
                }
            } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : String(err);
                if (msg.includes('token failed')) return NextResponse.json({ success: false, error: `OAuth failed: ${msg}` });
                if (msg.includes('timeout')) return NextResponse.json({ success: false, error: 'Instance unreachable (timeout).' });
                if (msg.includes('ENOTFOUND')) return NextResponse.json({ success: false, error: 'Cannot reach instance. Check the URL.' });
                return NextResponse.json({ success: false, error: msg });
            }
        }

        // Fetch incident
        if (!incidentNumber) {
            return NextResponse.json({ error: 'incidentNumber is required' }, { status: 400 });
        }

        try {
            const result = await callServiceNow(instanceUrl, config, `/api/now/table/incident?sysparm_query=number=${encodeURIComponent(incidentNumber.trim())}&sysparm_limit=1`);

            if (!result.ok) {
                let errorMsg = `HTTP ${result.status}`;
                try { errorMsg = JSON.parse(result.body).error?.message || errorMsg; } catch {}
                return NextResponse.json({ error: errorMsg }, { status: result.status });
            }

            const json = JSON.parse(result.body);
            const inc = json.result?.[0];
            if (!inc) return NextResponse.json({ error: `Incident "${incidentNumber}" not found.` }, { status: 404 });

            return NextResponse.json({
                incident: {
                    sys_id: inc.sys_id, number: inc.number || incidentNumber,
                    title: inc.short_description || 'Untitled', description: inc.description || '',
                    state: inc.state, priority: inc.priority,
                    assignment_group: inc.assignment_group?.display_value || '',
                    assigned_to: inc.assigned_to?.display_value || '',
                    category: inc.category || '', subcategory: inc.subcategory || '',
                    impact: inc.impact || '', urgency: inc.urgency || '',
                    sys_created_on: inc.sys_created_on || '', sys_updated_on: inc.sys_updated_on || '',
                },
            });
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            if (msg.includes('timeout')) return NextResponse.json({ error: 'Instance unreachable (timeout).' }, { status: 504 });
            return NextResponse.json({ error: msg }, { status: 500 });
        }
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed';
        console.error('[ServiceNow Error]', message);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
