import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const runtime = 'nodejs';

function writeDebugLog(content: string) {
    try {
        const logPath = path.join(process.cwd(), 'servicenow_debug.log');
        fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${content}\n\n`);
    } catch {}
}

async function getOAuthToken(
    instanceUrl: string,
    clientId: string,
    clientSecret: string,
    username?: string,
    password?: string
): Promise<string> {
    let baseUrl = instanceUrl.trim().replace(/\/$/, '');
    if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
        baseUrl = 'https://' + baseUrl;
    }

    // ServiceNow OAuth endpoint — only /oauth_token.do is valid
    const endpoint = '/oauth_token.do';
    const url = `${baseUrl}${endpoint}`;

    // Try password grant first (requires username + password + client credentials)
    const grantBodies: string[] = [];
    if (username && password) {
        grantBodies.push(
            `grant_type=password&client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(clientSecret)}&username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`
        );
    }
    // Also try client_credentials grant
    grantBodies.push(
        `grant_type=client_credentials&client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(clientSecret)}`
    );

    let lastError = '';

    for (const body of grantBodies) {
        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body,
                signal: AbortSignal.timeout(15000),
            });
            const text = await res.text();
            writeDebugLog(`OAuth ${url}\nBody: ${body.replace(/password=[^&]*/, 'password=***')}\nStatus: ${res.status}\nContent-Type: ${res.headers.get('content-type')}\nResponse: ${text.substring(0, 500)}`);

            const isJson = res.headers.get('content-type')?.includes('application/json') ||
                (text.trim().startsWith('{') && text.trim().endsWith('}'));

            if (!isJson) {
                lastError = `Non-JSON response from ${endpoint} (Status ${res.status}). The instance may not have OAuth enabled.`;
                continue;
            }

            const data = JSON.parse(text);

            if (res.ok && data.access_token) {
                writeDebugLog(`OAuth success using grant: ${body.split('&')[0]}`);
                return data.access_token;
            }

            lastError = data.error_description || data.error || `HTTP ${res.status}`;
        } catch (err: unknown) {
            lastError = err instanceof Error ? err.message : String(err);
        }
    }

    throw new Error(lastError);
}

async function callServiceNow(
    instanceUrl: string,
    config: Record<string, string>,
    endpoint: string
) {
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
        try {
            const token = await getOAuthToken(
                instanceUrl,
                config.clientId,
                config.clientSecret,
                config.username || undefined,
                config.password || undefined
            );
            headers['Authorization'] = `Bearer ${token}`;
            writeDebugLog(`Using OAuth Bearer token for: ${url}`);
        } catch (oauthErr: unknown) {
            // OAuth failed — fall back to Basic Auth if credentials are available
            const oauthErrMsg = oauthErr instanceof Error ? oauthErr.message : String(oauthErr);
            writeDebugLog(`OAuth failed (${oauthErrMsg}), falling back to Basic Auth for: ${url}`);
            if (config.username && config.password) {
                const auth = Buffer.from(`${config.username}:${config.password}`).toString('base64');
                headers['Authorization'] = `Basic ${auth}`;
                headers['X-Auth-Fallback'] = 'basic'; // marker for logging
            } else {
                // No fallback credentials available — rethrow
                throw oauthErr;
            }
        }
    } else {
        const auth = Buffer.from(`${config.username}:${config.password}`).toString('base64');
        headers['Authorization'] = `Basic ${auth}`;
    }

    writeDebugLog(`Calling ${url} with auth: ${headers['X-Auth-Fallback'] ? 'basic (fallback)' : config.authMethod || 'basic'}`);
    // Remove internal marker before sending
    delete headers['X-Auth-Fallback'];

    const res = await fetch(url, { headers, signal: AbortSignal.timeout(15000) });
    const bodyText = await res.text();
    writeDebugLog(`Response ${res.status}: ${bodyText.substring(0, 300)}`);
    return { status: res.status, body: bodyText, ok: res.ok };
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { instanceUrl, username, password, incidentNumber, action, authMethod, clientId, clientSecret } = body;

        if (!instanceUrl) {
            return NextResponse.json({ error: 'Instance URL is required' }, { status: 400 });
        }

        const isMock =
            instanceUrl.includes('dev12345') ||
            instanceUrl.includes('mock') ||
            instanceUrl.includes('example');

        const config: Record<string, string> = {
            instanceUrl,
            username: username || '',
            password: password || '',
            authMethod: authMethod || 'basic',
            clientId: clientId || '',
            clientSecret: clientSecret || '',
        };

        // ── Test connection ─────────────────────────────────────────────
        if (action === 'test') {
            if (isMock) {
                return NextResponse.json({
                    success: true,
                    message: `Connected as ${username || 'admin'} (Mock)`,
                    user: username || 'admin',
                });
            }

            try {
                const result = await callServiceNow(
                    instanceUrl,
                    config,
                    `/api/now/table/sys_user?sysparm_query=user_name=${encodeURIComponent(username || 'admin')}&sysparm_limit=1`
                );

                if (result.ok) {
                    const json = JSON.parse(result.body);
                    const user = json.result?.[0];
                    return NextResponse.json({
                        success: true,
                        message: `Connected as ${user?.name || username}`,
                        user: user?.name || username,
                    });
                } else {
                    let errorMsg = `HTTP ${result.status}`;
                    try { errorMsg = JSON.parse(result.body).error?.message || errorMsg; } catch {}
                    return NextResponse.json({ success: false, error: `Connection failed: ${errorMsg}` });
                }
            } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : String(err);
                return NextResponse.json({ success: false, error: `Connection failed: ${msg}` });
            }
        }

        // ── Fetch incident ──────────────────────────────────────────────
        if (!incidentNumber) {
            return NextResponse.json({ error: 'incidentNumber is required' }, { status: 400 });
        }

        const cleanIncNum = incidentNumber.trim();

        // Determine mock title/description keyed on the incident number
        let title = `Incident ${cleanIncNum} — SSO session timeout redirects incorrectly`;
        let description = `SSO portal reports session timeouts incorrectly for incident ${cleanIncNum}, redirecting users back to the workspace authentication page.`;

        if (cleanIncNum.includes('10003') || cleanIncNum.includes('903')) {
            title = `Incident ${cleanIncNum} — Database connection pool exhaustion`;
            description = `Database connection pool exhaustion detected for incident ${cleanIncNum}. Intermittent 503 Service Unavailable errors appear under high traffic load.`;
        } else if (cleanIncNum.includes('10002') || cleanIncNum.includes('902')) {
            title = `Incident ${cleanIncNum} — Stripe payment tokenization failure`;
            description = `Payment tokenization fails intermittently for incident ${cleanIncNum} when processing credit cards via the Stripe element.`;
        } else if (cleanIncNum.includes('10001') || cleanIncNum.includes('882')) {
            title = `Incident ${cleanIncNum} — User avatar image upload error`;
            description = `Users receive HTTP 500 when uploading avatar images larger than 2 MB (incident ${cleanIncNum}).`;
        }

        if (isMock) {
            return NextResponse.json({
                incident: {
                    sys_id: 'mock-sys-id', number: cleanIncNum,
                    title, description,
                    state: '2', priority: '1',
                    assignment_group: 'QA Support', assigned_to: 'John Doe',
                    category: 'Software', subcategory: 'Database',
                    impact: '1', urgency: '1',
                    sys_created_on: new Date().toISOString(), sys_updated_on: new Date().toISOString(),
                },
            });
        }

        try {
            const result = await callServiceNow(
                instanceUrl,
                config,
                `/api/now/table/incident?sysparm_query=number=${encodeURIComponent(cleanIncNum)}&sysparm_limit=1`
            );

            if (!result.ok) {
                let errorMsg = `HTTP ${result.status}`;
                try { errorMsg = JSON.parse(result.body).error?.message || errorMsg; } catch {}
                return NextResponse.json(
                    { error: `ServiceNow returned an error: ${errorMsg}` },
                    { status: result.status }
                );
            }

            const json = JSON.parse(result.body);
            const inc = json.result?.[0];
            if (!inc) {
                return NextResponse.json(
                    { error: `Incident "${cleanIncNum}" not found in ServiceNow.` },
                    { status: 404 }
                );
            }

            return NextResponse.json({
                incident: {
                    sys_id: inc.sys_id,
                    number: inc.number || cleanIncNum,
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
            return NextResponse.json(
                { error: `Failed to fetch incident: ${msg}` },
                { status: 500 }
            );
        }
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unexpected error';
        console.error('[ServiceNow Error]', message);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
