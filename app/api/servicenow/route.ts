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

        // Normalize instance URL
        let baseUrl = instanceUrl.trim().replace(/\/$/, '');
        if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
            baseUrl = 'https://' + baseUrl;
        }

        const auth = Buffer.from(`${username}:${password}`).toString('base64');
        const queryUrl = `${baseUrl}/api/now/table/incident?sysparm_query=number=${encodeURIComponent(incidentNumber.trim())}&sysparm_limit=1`;

        console.log('[ServiceNow] Fetching:', queryUrl.replace(/Basic .+/, 'Basic ***'));

        let res: Response;
        try {
            res = await fetch(queryUrl, {
                headers: {
                    Authorization: `Basic ${auth}`,
                    Accept: 'application/json',
                },
                signal: AbortSignal.timeout(15000),
            });
        } catch (fetchErr: unknown) {
            const msg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
            console.error('[ServiceNow] Fetch failed:', msg);
            if (msg.includes('timeout') || msg.includes('AbortError')) {
                return NextResponse.json({ error: 'ServiceNow instance is not reachable. Check the Instance URL.' }, { status: 504 });
            }
            if (msg.includes('ENOTFOUND') || msg.includes('ECONNREFUSED')) {
                return NextResponse.json({ error: `Cannot reach ServiceNow at "${baseUrl}". Check the Instance URL.` }, { status: 502 });
            }
            return NextResponse.json({ error: `Connection failed: ${msg}` }, { status: 500 });
        }

        console.log('[ServiceNow] Response status:', res.status);

        // Read body as text first to handle empty/non-JSON responses
        const bodyText = await res.text();
        console.log('[ServiceNow] Body length:', bodyText.length, 'starts with:', bodyText.slice(0, 100));

        if (!bodyText || bodyText.trim().length === 0) {
            return NextResponse.json(
                { error: `ServiceNow returned empty response (HTTP ${res.status}). ${res.status === 401 ? 'Check username/password.' : res.status === 404 ? 'Instance not found. Check the URL.' : 'Check instance configuration.'}` },
                { status: res.status || 500 }
            );
        }

        let json: { result?: any[] };
        try {
            json = JSON.parse(bodyText);
        } catch {
            // Response is not JSON — likely an HTML login page or error page
            const isHtml = bodyText.toLowerCase().includes('<!doctype') || bodyText.toLowerCase().includes('<html');
            return NextResponse.json(
                { error: `ServiceNow returned non-JSON response (${res.status}). ${isHtml ? 'Likely an authentication page — check username/password.' : bodyText.slice(0, 200)}` },
                { status: res.status }
            );
        }

        if (!res.ok) {
            const detail = json && typeof json === 'object' ? JSON.stringify(json).slice(0, 200) : '';
            return NextResponse.json(
                { error: `ServiceNow error ${res.status}: ${detail || res.statusText}` },
                { status: res.status }
            );
        }

        const result = json.result;

        if (!result || !Array.isArray(result) || result.length === 0) {
            return NextResponse.json(
                { error: `Incident "${incidentNumber}" not found. Check the incident number.` },
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
