import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../lib/prisma';

export async function GET() {
  const logs = await prisma.auditLog.findMany({ orderBy: { timestamp: 'desc' } });
  return NextResponse.json(logs);
}

export async function POST(request: NextRequest) {
  const data = await request.json();
  const log = await prisma.auditLog.create({ data });
  return NextResponse.json(log);
}