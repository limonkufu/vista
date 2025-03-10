import { NextRequest, NextResponse } from 'next/server';
import { getMockApiResponse } from '@/lib/mockApi';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const page = parseInt(searchParams.get('page') || '1');
  const per_page = parseInt(searchParams.get('per_page') || '25');

  // For testing, generate 50 MRs that are 14-27 days old
  const response = getMockApiResponse(14, 27, 50, { page, per_page });
  
  return NextResponse.json(response);
} 