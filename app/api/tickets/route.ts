import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../lib/prisma';

export async function GET() {
  const tickets = await prisma.ticket.findMany({ orderBy: { createdAt: 'desc' } });
  return NextResponse.json(tickets);
}

export async function POST(request: NextRequest) {
  const data = await request.json();
  const ticket = await prisma.ticket.create({
    data: { ...data, linkedTestCases: data.linkedTestCases || [], teamIds: data.teamIds || [] },
  });
  return NextResponse.json(ticket);
}