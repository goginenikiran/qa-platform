import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../lib/prisma';

export async function GET() {
  const requirements = await prisma.requirement.findMany({
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json(requirements);
}

export async function POST(request: NextRequest) {
  const data = await request.json();
  const requirement = await prisma.requirement.create({
    data: {
      ...data,
      linkedTestCases: data.linkedTestCases || [],
    },
  });
  return NextResponse.json(requirement);
}