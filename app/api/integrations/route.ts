import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../lib/prisma';

export async function GET() {
  try {
    const integrations = await prisma.integration.findMany({ orderBy: { createdAt: 'desc' } });
    return NextResponse.json(integrations);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Database error';
    console.error('[Integrations GET]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const integration = await prisma.integration.create({ data });
    return NextResponse.json(integration);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Database error';
    console.error('[Integrations POST]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
