import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../lib/prisma';

export async function GET() {
  const runs = await prisma.executionRun.findMany({ orderBy: { startedAt: 'desc' } });
  return NextResponse.json(runs);
}

export async function POST(request: NextRequest) {
  const data = await request.json();
  const run = await prisma.executionRun.create({ data });
  return NextResponse.json(run);
}