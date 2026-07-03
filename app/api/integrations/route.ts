import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../lib/prisma';

export async function GET() {
  const integrations = await prisma.integration.findMany({ orderBy: { createdAt: 'desc' } });
  return NextResponse.json(integrations);
}

export async function POST(request: NextRequest) {
  const data = await request.json();
  const integration = await prisma.integration.create({ data });
  return NextResponse.json(integration);
}