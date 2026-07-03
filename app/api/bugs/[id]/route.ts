import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const bug = await prisma.bug.findUnique({ where: { id } });
  if (!bug) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(bug);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const data = await request.json();
  const bug = await prisma.bug.update({
    where: { id },
    data: { ...data, updatedAt: new Date() },
  });
  return NextResponse.json(bug);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await prisma.bug.delete({ where: { id } });
  return NextResponse.json({ success: true });
}