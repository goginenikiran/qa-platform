import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const integration = await prisma.integration.findUnique({ where: { id } });
  if (!integration) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(integration);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const data = await request.json();
  const integration = await prisma.integration.update({
    where: { id },
    data: { ...data, updatedAt: new Date() },
  });
  return NextResponse.json(integration);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await prisma.integration.delete({ where: { id } });
  return NextResponse.json({ success: true });
}