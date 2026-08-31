import { prisma } from "../utils/prisma";
import { CategoryFilters } from "../types";

export const getCategories = async (filters: CategoryFilters) => {
	const { search, page = 1, limit = 10 } = filters;

	const where: any = {
		active: true,
	};

	if (search && search.trim()) {
		where.name = {
			contains: search,
			mode: "insensitive",
		};
	}

	const skip = (Number(page) - 1) * Number(limit);
	const take = Number(limit);

	try {
		const [categories, total] = await Promise.all([
			prisma.category.findMany({
				where,
				skip,
				take,
				orderBy: {
					name: "asc",
				},
			}),
			prisma.category.count({ where }),
		]);

		return {
			data: categories,
			total,
			page,
			limit,
			totalPages: Math.ceil(total / limit),
		};
	} catch (error) {
		console.error("Erro ao buscar categorias:", error);
		throw error;
	}
};

export const getCategoryById = async (id: number) => {
	const category = await prisma.category.findUnique({
		where: { id },
	});

	if (!category) {
		throw new Error("Categoria não encontrada");
	}

	return category;
};
