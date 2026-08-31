import { FastifyReply, FastifyRequest } from "fastify";
import { CategoryFilters, CreateCategory, UpdateCategory } from "../types";
import { getCategories, getCategoryById, createCategory, updateCategory, deleteCategory } from "../services/categories.service";
import { categoryFiltersSchema, createCategorySchema, updateCategorySchema } from "../utils/validators";
import slugify from "slugify";

export const listCategories = async (request: FastifyRequest<{ Querystring: CategoryFilters }>, reply: FastifyReply) => {
	const filters = categoryFiltersSchema.parse(request.query);
	const result = await getCategories(filters as CategoryFilters);
	reply.status(200).send(result);
};

export const getCategory = async (request: FastifyRequest<{ Params: { id: number } }>, reply: FastifyReply) => {
	const category = await getCategoryById(request.params.id);
	reply.status(200).send(category);
};

export const createNewCategory = async (request: FastifyRequest<{ Body: CreateCategory }>, reply: FastifyReply) => {
	const body = request.body;

	body.slug = slugify(body.name, {
		lower: true,
		strict: true,
		locale: "pt",
	});

	const validate = createCategorySchema.parse(body);
	await createCategory(validate);

	reply.status(201).send({ message: "Categoria criada com sucesso" });
};

export const updateExistingCategory = async (request: FastifyRequest<{ Params: { id: string }; Body: Partial<CreateCategory> }>, reply: FastifyReply) => {
	const { id } = request.params;
	const body = request.body;

	const validate = updateCategorySchema.parse(body);

	if (validate.name) {
		validate.slug = slugify(validate.name, {
			lower: true,
			strict: true,
			locale: "pt",
		});
	}

	const category = await updateCategory(Number(id), validate);
	reply.status(200).send(category);
};

export const deleteExistingCategory = async (request: FastifyRequest<{ Params: { id: number } }>, reply: FastifyReply) => {
	const { id } = request.params;
	await deleteCategory(id);
	reply.status(204).send();
};
