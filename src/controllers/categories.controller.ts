import { FastifyReply, FastifyRequest } from "fastify";
import { CategoryFilters } from "../types";
import { getCategories, getCategoryById } from "../services/categories.service";
import { categoryFiltersSchema } from "../utils/validators";

export const listCategories = async (request: FastifyRequest<{ Querystring: CategoryFilters }>, reply: FastifyReply) => {
	const filters = categoryFiltersSchema.parse(request.query);
	const result = await getCategories(filters as CategoryFilters);
	reply.status(200).send(result);
};

export const getCategory = async (request: FastifyRequest<{ Params: { id: number } }>, reply: FastifyReply) => {
	const category = await getCategoryById(request.params.id);
	reply.status(200).send(category);
};
