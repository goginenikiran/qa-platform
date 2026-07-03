import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const team = await prisma.team.findUnique({ where: { id } });
  if (!team) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(team);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const data = await request.json();
  const team = await prisma.team.update({
    where: { id },
    data: { ...data, updatedAt: new Date() },
  });
  return NextResponse.json(team);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await prisma.team.delete({ where: { id } });
  return NextResponse.json({ success: true });
}