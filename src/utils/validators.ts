import z from "zod";

export const loginSchema = z.object({
	email: z.email("Email inválido"),
	password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres"),
});

export const registerSchema = z.object({
	firstName: z.string().min(1, "Nome é obrigatório"),
	lastName: z.string().min(1, "Sobrenome é obrigatório"),
	email: z.email("Email inválido"),
	password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres"),
	cpf: z.string().optional(),
	birthDate: z.string().optional(),
	phone: z.string().optional(),
});

export const productFiltersSchema = z.object({
	page: z.coerce.number().int().min(1, "Página deve ser no mínimo 1").optional(),
	limit: z.coerce.number().int().min(1, "Limite deve ser no mínimo 1").optional(),
	minPrice: z.coerce.number().nonnegative("Preço mínimo deve ser positivo").optional(),
	maxPrice: z.coerce.number().nonnegative("Preço máximo deve ser positivo").optional(),
	search: z.string().optional(),
	categoryId: z.coerce.number().int().optional(),
	sortBy: z.enum(["price", "name", "createdAt"]).optional(),
	sortOrder: z.enum(["asc", "desc"]).optional(),
});

export const categoryFiltersSchema = z.object({
	page: z.coerce.number().int().min(1, "Página deve ser no mínimo 1").optional(),
	limit: z.coerce.number().int().min(1, "Limite deve ser no mínimo 1").optional(),
	search: z.string().optional(),
});

export const createProductSchema = z.object({
	name: z.string().min(1, "Nome é obrigatório"),
	description: z.string().min(1, "Descrição é obrigatória"),
	price: z.number().nonnegative("Preço deve ser positivo"),
	colors: z.array(z.string()).optional(),
	sizes: z.array(z.string()).optional(),
	slug: z.string().min(1, "Slug é obrigatório"),
	stock: z.number().int().nonnegative("Estoque deve ser positivo"),
	active: z.boolean(),
	images: z.array(z.string()).optional(),
	categoryId: z.number().int().min(1, "ID de categoria inválido"),
}); 

export const updateProductSchema = z.object({
	name: z.string().min(1, "Nome é obrigatório").optional(),
	description: z.string().min(1, "Descrição é obrigatória").optional(),
	price: z.number().nonnegative("Preço deve ser positivo").optional(),
	colors: z.array(z.string()).optional(),
	sizes: z.array(z.string()).optional(),
	slug: z.string().min(1, "Slug é obrigatório").optional(),
	stock: z.number().int().nonnegative("Estoque deve ser positivo").optional(),
	active: z.boolean().optional(),
	images: z.array(z.string()).optional(),
	categoryId: z.number().int().min(1, "ID de categoria inválido").optional(),
});

export const deleteProductSchema = z.object({
	id: z.number().int().min(1, "ID inválido"),
});