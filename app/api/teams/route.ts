import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../lib/prisma';

export async function GET() {
  const teams = await prisma.team.findMany({ orderBy: { createdAt: 'desc' } });
  return NextResponse.json(teams);
}

export async function POST(request: NextRequest) {
  const data = await request.json();
  const team = await prisma.team.create({ data });
  return NextResponse.json(team);
}