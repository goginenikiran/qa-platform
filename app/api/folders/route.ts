import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../lib/prisma';

export async function GET() {
  const folders = await prisma.folder.findMany({ orderBy: { createdAt: 'desc' } });
  return NextResponse.json(folders);
}

export async function POST(request: NextRequest) {
  const data = await request.json();
  const folder = await prisma.folder.create({ data });
  return NextResponse.json(folder);
}