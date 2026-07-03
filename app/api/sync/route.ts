import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
    try {
        const { platform, config } = await req.json();

        if (!platform) {
            return NextResponse.json({ error: 'platform required' }, { status: 400 });
        }

        interface TicketResult { id: string; ticketId: string; title: string; description: string; status: string; priority: string; platform: string; linkedTestCases: string[]; createdAt: string; updatedAt: string; lastSyncAt: string; }
        let tickets: TicketResult[] = [];

        switch (platform) {
            case 'jira': {
                const { baseUrl, email, apiToken, projectKey } = config || {};
                if (baseUrl && email && apiToken) {
                    try {
                        const auth = Buffer.from(`${email}:${apiToken}`).toString('base64');
                        const res = await fetch(`${baseUrl}/rest/api/3/search?jql=project=${projectKey || 'TEST'}`, {
                            headers: { Authorization: `Basic ${auth}`, Accept: 'application/json' },
                        });
                        if (res.ok) {
                            const json: { issues?: { id: string; key: string; fields?: { summary?: string; description?: string; status?: { name?: string }; priority?: { name?: string }; created?: string; updated?: string } }[] } = await res.json();
                            tickets = (json.issues || []).map((issue) => ({
                                id: `jira-${issue.id}`,
                                ticketId: issue.key,
                                title: issue.fields?.summary || 'Untitled',
                                description: issue.fields?.description || '',
                                status: mapJiraStatus(issue.fields?.status?.name),
                                priority: mapPriority(issue.fields?.priority?.name),
                                platform: 'jira',
                                linkedTestCases: [],
                                createdAt: issue.fields?.created || new Date().toISOString(),
                                updatedAt: issue.fields?.updated || new Date().toISOString(),
                                lastSyncAt: new Date().toISOString(),
                            }));
                        }
                    } catch {
                        // Fall through to mock data if connection fails
                    }
                }
                if (tickets.length === 0) {
                    tickets = getMockTickets('jira');
                }
                break;
            }

            case 'servicenow': {
                const { instanceUrl, username, password } = config || {};
                if (instanceUrl && username && password) {
                    try {
                        const auth = Buffer.from(`${username}:${password}`).toString('base64');
                        const res = await fetch(`${instanceUrl}/api/now/table/incident?sysparm_limit=10`, {
                            headers: { Authorization: `Basic ${auth}`, Accept: 'application/json' },
                        });
                        if (res.ok) {
                            const json: { result?: { sys_id: string; number?: string; short_description?: string; description?: string; state?: string; priority?: string; sys_created_on?: string; sys_updated_on?: string }[] } = await res.json();
                            tickets = (json.result || []).map((inc) => ({
                                id: `snow-${inc.sys_id}`,
                                ticketId: inc.number || `SNOW-${Date.now()}`,
                                title: inc.short_description || 'Untitled',
                                description: inc.description || '',
                                status: mapSnowStatus(inc.state),
                                priority: mapPriority(inc.priority),
                                platform: 'servicenow',
                                linkedTestCases: [],
                                createdAt: inc.sys_created_on || new Date().toISOString(),
                                updatedAt: inc.sys_updated_on || new Date().toISOString(),
                                lastSyncAt: new Date().toISOString(),
                            }));
                        }
                    } catch {
                        // Fall through
                    }
                }
                if (tickets.length === 0) {
                    tickets = getMockTickets('servicenow');
                }
                break;
            }

            case 'github': {
                const { repo, token } = config || {};
                if (repo && token) {
                    try {
                        const res = await fetch(`https://api.github.com/repos/${repo}/issues?state=all&per_page=10`, {
                            headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github.v3+json' },
                        });
                        if (res.ok) {
                            const json: { id: number; number: number; title?: string; body?: string; state?: string; labels?: { name?: string }[]; created_at?: string; updated_at?: string }[] = await res.json();
                            tickets = (json || []).map((issue) => ({
                                id: `gh-${issue.id}`,
                                ticketId: `GH-${issue.number}`,
                                title: issue.title || 'Untitled',
                                description: issue.body || '',
                                status: issue.state === 'open' ? 'Open' : 'Closed' as const,
                                priority: mapPriority(issue.labels?.[0]?.name),
                                platform: 'github',
                                linkedTestCases: [],
                                createdAt: issue.created_at || new Date().toISOString(),
                                updatedAt: issue.updated_at || new Date().toISOString(),
                                lastSyncAt: new Date().toISOString(),
                            }));
                        }
                    } catch {
                        // Fall through
                    }
                }
                if (tickets.length === 0) {
                    tickets = getMockTickets('github');
                }
                break;
            }

            case 'azure': {
                tickets = getMockTickets('azure');
                break;
            }

            default:
                return NextResponse.json({ error: `Unsupported platform: ${platform}` }, { status: 400 });
        }

        return NextResponse.json({ tickets, count: tickets.length, platform });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Sync failed';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

function mapJiraStatus(status?: string): string {
    if (!status) return 'Open';
    const s = status.toLowerCase();
    if (s.includes('done') || s.includes('closed') || s.includes('resolved')) return 'Closed';
    if (s.includes('progress') || s.includes('in progress')) return 'In Progress';
    return 'Open';
}

function mapSnowState(state?: string): string {
    if (!state) return 'Open';
    const s = parseInt(state);
    if (s === 3 || s === 7) return 'Closed';
    if (s === 2) return 'In Progress';
    return 'Open';
}

function mapSnowStatus(state?: string): string {
    return mapSnowState(state);
}

function mapPriority(priority?: string): string {
    if (!priority) return 'Medium';
    const p = priority.toLowerCase();
    if (p.includes('critical') || p === '1') return 'Critical';
    if (p.includes('high') || p === '2') return 'High';
    if (p.includes('low') || p === '4') return 'Low';
    return 'Medium';
}

interface MockTicket { ticketId: string; title: string; description: string; status: string; priority: string; }

function getMockTickets(platform: string): { id: string; ticketId: string; title: string; description: string; status: string; priority: string; platform: string; linkedTestCases: string[]; createdAt: string; updatedAt: string; lastSyncAt: string }[] {
    const now = new Date().toISOString();
    const templates: Record<string, MockTicket[]> = {
        jira: [
            { ticketId: 'JIRA-881', title: 'Stripe tokenization mismatch error', description: 'Verify checkout throws random failures in Stripe element token mapping.', status: 'In Progress', priority: 'Critical' },
            { ticketId: 'JIRA-882', title: 'User profile avatar upload fails', description: 'Avatar upload returns 500 for images > 2MB.', status: 'Open', priority: 'High' },
        ],
        servicenow: [
            { ticketId: 'SNOW-902', title: 'SSO session timeout redirects incorrectly', description: 'SSO portal reports session timeouts incorrectly, redirecting back to workspace auth page.', status: 'Open', priority: 'High' },
            { ticketId: 'SNOW-903', title: 'Database connection pool exhaustion', description: 'Connection pool maxes out under load causing 503 errors.', status: 'In Progress', priority: 'Critical' },
        ],
        github: [
            { ticketId: 'GH-216', title: 'Fix pagination offset on search results', description: 'Search results page 2+ returns duplicate entries.', status: 'Open', priority: 'Medium' },
            { ticketId: 'GH-217', title: 'Add rate limiting to public API', description: 'Public endpoints need rate limiting to prevent abuse.', status: 'Open', priority: 'High' },
        ],
        azure: [
            { ticketId: 'AZ-101', title: 'Deployment pipeline stalled on staging', description: 'Azure DevOps pipeline fails at integration test stage.', status: 'Open', priority: 'Critical' },
            { ticketId: 'AZ-102', title: 'Update terraform scripts for new region', description: 'Add support for APAC region infrastructure.', status: 'In Progress', priority: 'Medium' },
        ],
    };
    return (templates[platform] || []).map((t, i) => ({
        id: `sync-${platform}-${i}-${Date.now()}`,
        ...t,
        platform,
        linkedTestCases: [],
        createdAt: now,
        updatedAt: now,
        lastSyncAt: now,
    }));
}
