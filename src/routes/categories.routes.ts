import { FastifyInstance } from "fastify";
import { listCategories, getCategory } from "../controllers/categories.controller";
import { authenticate } from "../middlewares/auth.middleware";

export default async function categoryRoutes(fastify: FastifyInstance) {
	//fastify.addHook("onRequest", authenticate);

	fastify.get(
		"/",
		{
			schema: {
				tags: ["Categories"],
				description: "Lista categorias com filtros opcionais",
				security: [{ bearerAuth: [] }],
				querystring: {
					type: "object",
					properties: {
						page: { type: "number", description: "Número da página" },
						limit: { type: "number", description: "Itens por página" },
						search: { type: "string", description: "Busca por nome" },
					},
				},
				response: {
					200: {
						description: "Lista de categorias",
						type: "object",
						properties: {
							data: {
								type: "array",
								items: {
									type: "object",
									properties: {
										id: { type: "number" },
										name: { type: "string" },
										slug: { type: "string" },
										description: { type: "string", nullable: true },
										active: { type: "boolean" },
										createdAt: { type: "string", format: "date-time" },
										updatedAt: { type: "string", format: "date-time" },
									},
								},
							},
							total: { type: "number" },
							page: { type: "number" },
							limit: { type: "number" },
							totalPages: { type: "number" },
						},
					},
					400: {
						description: "Requisição inválida",
						type: "object",
						properties: {
							message: { type: "string" },
						},
					},
					401: {
						description: "Não autorizado",
						type: "object",
						properties: {
							message: { type: "string" },
						},
					},
					500: {
						description: "Erro interno do servidor",
						type: "object",
						properties: {
							message: { type: "string" },
						},
					},
				},
			},
		},
		listCategories
	);

	fastify.get(
		"/:id",
		{
			schema: {
				tags: ["Categories"],
				description: "Obter uma categoria pelo ID",
				security: [{ bearerAuth: [] }],
				params: {
					type: "object",
					properties: {
						id: { type: "number", description: "ID da categoria" },
					},
					required: ["id"],
				},
				response: {
					200: {
						description: "Categoria encontrada",
						type: "object",
						properties: {
							id: { type: "number" },
							name: { type: "string" },
							slug: { type: "string" },
							description: { type: "string", nullable: true },
							active: { type: "boolean" },
							createdAt: { type: "string", format: "date-time" },
							updatedAt: { type: "string", format: "date-time" },
						},
					},
					400: {
						description: "Requisição inválida",
						type: "object",
						properties: {
							message: { type: "string" },
						},
					},
					401: {
						description: "Não autorizado",
						type: "object",
						properties: {
							message: { type: "string" },
						},
					},
					404: {
						description: "Categoria não encontrada",
						type: "object",
						properties: {
							message: { type: "string" },
						},
					},
					500: {
						description: "Erro interno do servidor",
						type: "object",
						properties: {
							message: { type: "string" },
						},
					},
				},
			},
		},
		getCategory
	);
}
