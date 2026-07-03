import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../lib/prisma';

export async function GET() {
  const bugs = await prisma.bug.findMany({ orderBy: { createdAt: 'desc' } });
  return NextResponse.json(bugs);
}

export async function POST(request: NextRequest) {
  const data = await request.json();
  const bug = await prisma.bug.create({ data });
  return NextResponse.json(bug);
}