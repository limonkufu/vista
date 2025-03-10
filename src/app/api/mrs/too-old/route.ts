import { NextRequest, NextResponse } from 'next/server';
import { getMockApiResponse } from '@/lib/mockApi';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const page = parseInt(searchParams.get('page') || '1');
  const per_page = parseInt(searchParams.get('per_page') || '25');

  // For testing, generate 75 MRs that are 28-60 days old
  const response = getMockApiResponse(28, 60, 75, { page, per_page });
  
  return NextResponse.json(response);
} 