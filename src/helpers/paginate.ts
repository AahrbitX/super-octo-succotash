export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationMeta;
}

export async function paginate<T>({
  page = 1,
  limit = 20,
  getData,
  getTotal,
}: {
  page?: number;
  limit?: number;
  getData: (args: { offset: number; limit: number }) => Promise<T[]>;
  getTotal: () => Promise<number>;
}): Promise<PaginatedResponse<T>> {
  const offset = (page - 1) * limit;

  const [data, total] = await Promise.all([
    getData({ offset, limit }),
    getTotal(),
  ]);

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNext: page * limit < total,
      hasPrevious: page > 1,
    },
  };
}
