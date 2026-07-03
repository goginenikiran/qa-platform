import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const folder = await prisma.folder.findUnique({ where: { id } });
  if (!folder) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(folder);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const data = await request.json();
  const folder = await prisma.folder.update({
    where: { id },
    data: { ...data, updatedAt: new Date() },
  });
  return NextResponse.json(folder);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await prisma.folder.delete({ where: { id } });
  return NextResponse.json({ success: true });
}