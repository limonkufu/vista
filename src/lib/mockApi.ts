import { GitLabMR } from './gitlab';
import { generateMockMRs } from './mockData';

interface MockApiOptions {
  page?: number;
  per_page?: number;
}

export const getMockApiResponse = (
  minDays: number,
  maxDays: number,
  totalItems: number,
  options: MockApiOptions = {}
) => {
  const { page = 1, per_page = 25 } = options;
  const allMRs = generateMockMRs(totalItems, minDays, maxDays);
  
  const start = (page - 1) * per_page;
  const end = start + per_page;
  const items = allMRs.slice(start, end);
  
  const totalPages = Math.ceil(totalItems / per_page);
  
  return {
    items,
    metadata: {
      threshold: minDays,
      lastRefreshed: new Date().toISOString(),
      currentPage: page,
      totalPages,
      perPage: per_page,
    },
  };
}; 