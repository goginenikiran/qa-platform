import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../lib/prisma';

export async function GET() {
  const testCases = await prisma.testCase.findMany({
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json(testCases);
}

export async function POST(request: NextRequest) {
  const data = await request.json();
  const testCase = await prisma.testCase.create({
    data: {
      ...data,
      steps: data.steps || [],
      tags: data.tags || [],
      ticketIds: data.ticketIds || [],
    },
  });
  return NextResponse.json(testCase);
}