import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

// In-memory store (reset on server restart — use with localStorage on client for persistence)
const db: Record<string, unknown[]> = {};

function getEntity(entity: string): unknown[] {
    return db[entity] || [];
}

function setEntity(entity: string, data: unknown[]): void {
    db[entity] = data;
}

export async function GET(req: NextRequest) {
    const entity = req.nextUrl.searchParams.get('entity');
    if (!entity) return NextResponse.json({ error: 'entity param required' }, { status: 400 });
    return NextResponse.json({ data: getEntity(entity) });
}

export async function POST(req: NextRequest) {
    const entity = req.nextUrl.searchParams.get('entity');
    if (!entity) return NextResponse.json({ error: 'entity param required' }, { status: 400 });

    const body = await req.json();
    const action = body.action;
    const payload = body.payload;

    if (!action) return NextResponse.json({ error: 'action required' }, { status: 400 });

    const store = getEntity(entity);

    switch (action) {
        case 'list':
            return NextResponse.json({ data: store });

        case 'get': {
            const arr = store as Record<string, unknown>[];
            const item = arr.find((i: Record<string, unknown>) => i.id === payload.id);
            if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });
            return NextResponse.json({ data: item });
        }

        case 'create': {
            if (!payload.id) return NextResponse.json({ error: 'payload.id required' }, { status: 400 });
            setEntity(entity, [...store, payload]);
            return NextResponse.json({ data: payload });
        }

        case 'update': {
            if (!payload.id) return NextResponse.json({ error: 'payload.id required' }, { status: 400 });
            setEntity(entity, (store as Record<string, unknown>[]).map((i: Record<string, unknown>) => i.id === payload.id ? payload : i));
            return NextResponse.json({ data: payload });
        }

        case 'delete': {
            if (!payload) return NextResponse.json({ error: 'payload (id) required' }, { status: 400 });
            setEntity(entity, (store as Record<string, unknown>[]).filter((i: Record<string, unknown>) => i.id !== payload));
            return NextResponse.json({ success: true });
        }

        case 'sync': {
            if (!Array.isArray(payload)) return NextResponse.json({ error: 'payload must be an array for sync' }, { status: 400 });
            const arr = store as Record<string, unknown>[];
            const manual = arr.filter((i: Record<string, unknown>) => i.platform === 'manual');
            const filteredManual = manual.filter((m: Record<string, unknown>) => !(payload as Record<string, unknown>[]).some((p: Record<string, unknown>) => p.ticketId === m.ticketId));
            setEntity(entity, [...filteredManual, ...payload]);
            return NextResponse.json({ data: [...filteredManual, ...payload] });
        }

        default:
            return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
}

// Sync endpoints
export async function PUT(req: NextRequest) {
    const body = await req.json();
    const { action, data } = body;

    if (action === 'export') {
        const exportData: Record<string, unknown[]> = {};
        for (const key of Object.keys(db)) {
            exportData[key] = db[key];
        }
        return NextResponse.json({ data: exportData });
    }

    if (action === 'import') {
        if (!data || typeof data !== 'object') {
            return NextResponse.json({ error: 'Invalid import data' }, { status: 400 });
        }
        for (const [key, value] of Object.entries(data)) {
            if (Array.isArray(value)) {
                db[key] = value;
            }
        }
        return NextResponse.json({ success: true, entities: Object.keys(data) });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
}
