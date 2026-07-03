import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const requirement = await prisma.requirement.findUnique({ where: { id } });
  if (!requirement) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(requirement);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const data = await request.json();
  const requirement = await prisma.requirement.update({
    where: { id },
    data: { ...data, updatedAt: new Date() },
  });
  return NextResponse.json(requirement);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await prisma.requirement.delete({ where: { id } });
  return NextResponse.json({ success: true });
}