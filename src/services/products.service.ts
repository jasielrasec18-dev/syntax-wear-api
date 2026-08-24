import { prisma } from '../utils/prisma';
import { ProductFilters } from '../types';

export const getProducts = async (filter: ProductFilters) => {
  const { 
    minPrice, 
    maxPrice, 
    search, 
    sortBy, 
    sortOrder, 
    page = 1, 
    limit = 10 
  } = filter;

  const where: any = {};

  if (minPrice !== undefined || maxPrice !== undefined) {
    where.price = {};
    if (minPrice !== undefined) {
      where.price.gte = Number(minPrice);
    }
    if (maxPrice !== undefined) {
      where.price.lte = Number(maxPrice);
    }
  }

  if (search && search.trim()) {
    where.OR = [
      {
        name: {
          contains: search,
          mode: 'insensitive',
        },
      },
      {
        description: {
          contains: search,
          mode: 'insensitive',
        },
      },
    ];
  }

  const skip = (Number(page) - 1) * Number(limit);
  const take = Number(limit);

  const orderBy: any = {};
  if (sortBy) {
    orderBy[sortBy] = sortOrder || 'asc';
  }

  try {
    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy: Object.keys(orderBy).length > 0 ? orderBy : undefined,
        skip,
        take,
      }),
      prisma.product.count({ where }),
    ]);

    return {
      data: products,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  } catch (error) {
    console.error('Erro ao buscar produtos:', error);
    throw error;
  }
};