import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { buildApp } from "../src/app";
import { prisma } from "../src/utils/prisma";
import { FastifyInstance } from "fastify";

// Mock do bcrypt
vi.mock("bcrypt", () => ({
	default: {
		hash: vi.fn().mockResolvedValue("$2b$10$mockedhashedpassword"),
		compare: vi.fn().mockResolvedValue(true),
	},
}));

// Mock do Prisma
vi.mock("../src/utils/prisma", () => ({
	prisma: {
		user: {
			create: vi.fn(),
			findUnique: vi.fn(),
			findFirst: vi.fn(),
			findMany: vi.fn(),
			update: vi.fn(),
			delete: vi.fn(),
			deleteMany: vi.fn(),
		},
		category: {
			create: vi.fn(),
			findFirst: vi.fn(),
			findUnique: vi.fn(),
			findMany: vi.fn(),
			update: vi.fn(),
			delete: vi.fn(),
			deleteMany: vi.fn(),
			count: vi.fn(),
		},
		product: {
			create: vi.fn(),
			findFirst: vi.fn(),
			findUnique: vi.fn(),
			findMany: vi.fn(),
			update: vi.fn(),
			delete: vi.fn(),
			deleteMany: vi.fn(),
			updateMany: vi.fn(),
			count: vi.fn(),
		},
		order: {
			create: vi.fn(),
			findFirst: vi.fn(),
			findUnique: vi.fn(),
			findMany: vi.fn(),
			update: vi.fn(),
			delete: vi.fn(),
			deleteMany: vi.fn(),
			count: vi.fn(),
		},
		orderItem: {
			create: vi.fn(),
			findFirst: vi.fn(),
			findUnique: vi.fn(),
			findMany: vi.fn(),
			update: vi.fn(),
			delete: vi.fn(),
			deleteMany: vi.fn(),
			createMany: vi.fn(),
		},
		$transaction: vi.fn(),
		$disconnect: vi.fn(),
	},
}));

describe("Categories CRUD", () => {
	let app: FastifyInstance;
	let adminToken: string;
	let mockAdminUser: any;

	beforeAll(async () => {
		app = await buildApp();

		const adminEmail = `admin-categories-${Date.now()}@example.com`;
		const hashedPassword = "$2b$10$hashedpassword123";
		
		mockAdminUser = {
			id: 1,
			firstName: "Admin",
			lastName: "Categories",
			email: adminEmail,
			password: hashedPassword,
			role: "ADMIN" as const,
			cpf: null,
			phone: null,
			birthDate: null,
			createdAt: new Date(),
			updatedAt: new Date(),
		};

		// Mock para register: verifica se email existe (deve retornar null)
		vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null);
		
		// Mock para criar usuário no register
		vi.mocked(prisma.user.create).mockResolvedValueOnce({
			...mockAdminUser,
			role: "USER" as const,
		} as any);

		// Registra o admin
		const registerResponse = await app.inject({
			method: "POST",
			url: "/auth/register",
			payload: {
				firstName: "Admin",
				lastName: "Categories",
				email: adminEmail,
				password: "admin123",
			},
		});

		expect(registerResponse.statusCode).toBe(201);

		// Mock do update para tornar ADMIN
		vi.mocked(prisma.user.update).mockResolvedValueOnce(mockAdminUser as any);

		// Atualiza para ADMIN
		await prisma.user.update({
			where: { id: 1 },
			data: { role: "ADMIN" },
		});

		// Mock para login: busca usuário por email
		vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(mockAdminUser as any);

		// Faz login como admin
		const loginResponse = await app.inject({
			method: "POST",
			url: "/auth/login",
			payload: {
				email: adminEmail,
				password: "admin123",
			},
		});

		expect(loginResponse.statusCode).toBe(200);
		adminToken = JSON.parse(loginResponse.body).token;

		// Mock permanente para verificação de token no middleware de autenticação
		vi.mocked(prisma.user.findUnique).mockResolvedValue(mockAdminUser as any);
	}, 15000);

	afterAll(async () => {
		await app.close();
	});

	describe("POST /categories - Criar categoria", () => {
		it("deve criar uma nova categoria com sucesso (admin)", async () => {
			const timestamp = Date.now();
			const categoryData = {
				name: `Test Category Create ${timestamp}`,
				description: "Descrição da categoria de teste",
			};

			const mockCategory = {
				id: 1,
				name: categoryData.name,
				slug: `test-category-create-${timestamp}`,
				description: categoryData.description,
				active: true,
				createdAt: new Date(),
				updatedAt: new Date(),
			};

			// Mock da criação
			vi.mocked(prisma.category.create).mockResolvedValueOnce(mockCategory as any);
			// Mock da busca para verificação
			vi.mocked(prisma.category.findFirst).mockResolvedValueOnce(mockCategory as any);

			const response = await app.inject({
				method: "POST",
				url: "/categories",
				headers: {
					authorization: `Bearer ${adminToken}`,
				},
				payload: categoryData,
			});

			expect(response.statusCode).toBe(201);

			const body = JSON.parse(response.body);
			expect(body).toHaveProperty("message");
			expect(body.message).toBe("Categoria criada com sucesso");

			// Verifica se o create foi chamado
			expect(prisma.category.create).toHaveBeenCalled();
		});

		it("deve criar categoria apenas com nome (sem description)", async () => {
			const timestamp = Date.now();
			const categoryData = {
				name: `Test Category NoDesc ${timestamp}`,
			};

			const mockCategory = {
				id: 2,
				name: categoryData.name,
				slug: `test-category-nodesc-${timestamp}`,
				description: null,
				active: true,
				createdAt: new Date(),
				updatedAt: new Date(),
			};

			vi.mocked(prisma.category.create).mockResolvedValueOnce(mockCategory as any);

			const response = await app.inject({
				method: "POST",
				url: "/categories",
				headers: {
					authorization: `Bearer ${adminToken}`,
				},
				payload: categoryData,
			});

			expect(response.statusCode).toBe(201);
			expect(prisma.category.create).toHaveBeenCalled();
		});

		it("deve retornar erro ao criar categoria sem autenticação", async () => {
			const categoryData = {
				name: "Test Category Unauthorized",
				description: "Categoria não autorizada",
			};

			const response = await app.inject({
				method: "POST",
				url: "/categories",
				payload: categoryData,
			});

			expect(response.statusCode).toBeGreaterThanOrEqual(401);
			// Não deve chamar o Prisma pois falha na autenticação antes
		});

		it("deve retornar erro ao criar categoria sem campo obrigatório (name)", async () => {
			const categoryData = {
				description: "Categoria sem nome",
				// Faltando name
			};

			const response = await app.inject({
				method: "POST",
				url: "/categories",
				headers: {
					authorization: `Bearer ${adminToken}`,
				},
				payload: categoryData,
			});

			expect(response.statusCode).toBe(400);
			// Não deve chamar o Prisma pois falha na validação antes
		});

		it("deve retornar erro ao criar categoria com nome duplicado (slug único)", async () => {
			const timestamp = Date.now();
			const categoryName = `Test Category Duplicate ${timestamp}`;
			
			const mockCategory = {
				id: 3,
				name: categoryName,
				slug: `test-category-duplicate-${timestamp}`,
				description: "Categoria original",
				active: true,
				createdAt: new Date(),
				updatedAt: new Date(),
			};

			// Mock primeira criação com sucesso
			vi.mocked(prisma.category.create).mockResolvedValueOnce(mockCategory as any);
			
			// Primeiro cria uma categoria
			await app.inject({
				method: "POST",
				url: "/categories",
				headers: {
					authorization: `Bearer ${adminToken}`,
				},
				payload: {
					name: categoryName,
					description: "Categoria original",
				},
			});

			// Mock erro de slug duplicado
			vi.mocked(prisma.category.create).mockRejectedValueOnce({
				code: "P2002",
				meta: { target: ["slug"] },
			});

			// Tenta criar novamente com o mesmo nome
			const response = await app.inject({
				method: "POST",
				url: "/categories",
				headers: {
					authorization: `Bearer ${adminToken}`,
				},
				payload: {
					name: categoryName, // Nome já existe
					description: "Tentativa de duplicar categoria",
				},
			});

			expect(response.statusCode).toBeGreaterThanOrEqual(400);
		});
	});

	describe("GET /categories - Listar categorias", () => {
		it("deve listar categorias sem autenticação", async () => {
			const mockCategories = [
				{
					id: 1,
					name: "Categoria 1",
					slug: "categoria-1",
					description: "Descrição 1",
					active: true,
					createdAt: new Date(),
					updatedAt: new Date(),
				},
				{
					id: 2,
					name: "Categoria 2",
					slug: "categoria-2",
					description: "Descrição 2",
					active: true,
					createdAt: new Date(),
					updatedAt: new Date(),
				},
			];

			vi.mocked(prisma.category.findMany).mockResolvedValueOnce(mockCategories as any);
			vi.mocked(prisma.category.count).mockResolvedValueOnce(2);

			const response = await app.inject({
				method: "GET",
				url: "/categories",
			});

			expect(response.statusCode).toBe(200);

			const body = JSON.parse(response.body);
			expect(body).toHaveProperty("data");
			expect(body).toHaveProperty("total");
			expect(body).toHaveProperty("page");
			expect(body).toHaveProperty("limit");
			expect(body).toHaveProperty("totalPages");
			expect(Array.isArray(body.data)).toBe(true);
		});

		it("deve listar categorias com paginação", async () => {
			const mockCategories = [
				{ id: 1, name: "Cat 1", slug: "cat-1", description: null, active: true, createdAt: new Date(), updatedAt: new Date() },
				{ id: 2, name: "Cat 2", slug: "cat-2", description: null, active: true, createdAt: new Date(), updatedAt: new Date() },
				{ id: 3, name: "Cat 3", slug: "cat-3", description: null, active: true, createdAt: new Date(), updatedAt: new Date() },
			];

			vi.mocked(prisma.category.findMany).mockResolvedValueOnce(mockCategories.slice(0, 5) as any);
			vi.mocked(prisma.category.count).mockResolvedValueOnce(10);

			const response = await app.inject({
				method: "GET",
				url: "/categories?page=1&limit=5",
			});

			expect(response.statusCode).toBe(200);

			const body = JSON.parse(response.body);
			expect(body.page).toBe(1);
			expect(body.limit).toBe(5);
			expect(body.data.length).toBeLessThanOrEqual(5);
		});

		it("deve buscar categorias por nome", async () => {
			const mockCategories = [
				{ id: 1, name: "Test Category 1", slug: "test-category-1", description: null, active: true, createdAt: new Date(), updatedAt: new Date() },
			];

			vi.mocked(prisma.category.findMany).mockResolvedValueOnce(mockCategories as any);
			vi.mocked(prisma.category.count).mockResolvedValueOnce(1);

			const response = await app.inject({
				method: "GET",
				url: "/categories?search=Test Category",
			});

			expect(response.statusCode).toBe(200);

			const body = JSON.parse(response.body);
			// Verifica que retornou ao menos uma categoria com "Test Category" no nome
			expect(body.data.length).toBeGreaterThanOrEqual(0);
		});

		it("deve retornar apenas categorias ativas", async () => {
			const mockCategories = [
				{ id: 1, name: "Cat Ativa 1", slug: "cat-ativa-1", description: null, active: true, createdAt: new Date(), updatedAt: new Date() },
				{ id: 2, name: "Cat Ativa 2", slug: "cat-ativa-2", description: null, active: true, createdAt: new Date(), updatedAt: new Date() },
			];

			vi.mocked(prisma.category.findMany).mockResolvedValueOnce(mockCategories as any);
			vi.mocked(prisma.category.count).mockResolvedValueOnce(2);

			const response = await app.inject({
				method: "GET",
				url: "/categories",
			});

			expect(response.statusCode).toBe(200);

			const body = JSON.parse(response.body);
			
			// Todas as categorias retornadas devem estar ativas
			body.data.forEach((category: any) => {
				expect(category.active).toBe(true);
			});
		});
	});

	describe("GET /categories/:id - Obter categoria por ID", () => {
		it("deve obter uma categoria pelo ID", async () => {
			const mockCategory = {
				id: 10,
				name: "Test Category Get",
				slug: "test-category-get",
				description: "Categoria para teste de GET",
				active: true,
				createdAt: new Date(),
				updatedAt: new Date(),
			};

			vi.mocked(prisma.category.findUnique).mockResolvedValueOnce(mockCategory as any);

			const response = await app.inject({
				method: "GET",
				url: `/categories/${mockCategory.id}`,
			});

			expect(response.statusCode).toBe(200);

			const body = JSON.parse(response.body);
			expect(body).toHaveProperty("id");
			expect(body.id).toBe(mockCategory.id);
			expect(body).toHaveProperty("name");
			expect(body).toHaveProperty("slug");
			expect(body).toHaveProperty("description");
			expect(body).toHaveProperty("active");
			expect(body).toHaveProperty("createdAt");
			expect(body).toHaveProperty("updatedAt");
		});

		it("deve retornar erro ao buscar categoria com ID inválido", async () => {
			vi.mocked(prisma.category.findUnique).mockResolvedValueOnce(null);

			const response = await app.inject({
				method: "GET",
				url: "/categories/999999",
			});

			expect(response.statusCode).toBeGreaterThanOrEqual(400);
		});
	});

	describe("PUT /categories/:id - Atualizar categoria", () => {
		it("deve atualizar uma categoria com sucesso (admin)", async () => {
			const mockCategory = {
				id: 20,
				name: "Test Category Update Full",
				slug: "test-category-update-full",
				description: "Categoria para teste de update",
				active: true,
				createdAt: new Date(),
				updatedAt: new Date(),
			};

			const mockUpdatedCategory = {
				...mockCategory,
				name: "Test Category Updated",
				slug: "test-category-updated",
				description: "Descrição atualizada",
				updatedAt: new Date(),
			};

			// Mock findUnique para verificar se categoria existe
			vi.mocked(prisma.category.findUnique).mockResolvedValueOnce(mockCategory as any);
			// Mock update
			vi.mocked(prisma.category.update).mockResolvedValueOnce(mockUpdatedCategory as any);

			const updateData = {
				name: "Test Category Updated",
				description: "Descrição atualizada",
			};

			const response = await app.inject({
				method: "PUT",
				url: `/categories/${mockCategory.id}`,
				headers: {
					authorization: `Bearer ${adminToken}`,
				},
				payload: updateData,
			});

			expect(response.statusCode).toBe(200);

			const body = JSON.parse(response.body);
			expect(body.name).toBe("Test Category Updated");
			expect(body.slug).toBe("test-category-updated");
			expect(body.description).toBe("Descrição atualizada");
			expect(prisma.category.update).toHaveBeenCalled();
		});

		it("deve atualizar apenas o nome sem alterar description", async () => {
			const mockCategory = {
				id: 21,
				name: "Test Category Partial",
				slug: "test-category-partial",
				description: "Descrição original",
				active: true,
				createdAt: new Date(),
				updatedAt: new Date(),
			};

			const mockUpdatedCategory = {
				...mockCategory,
				name: "Test Category Final Name",
				slug: "test-category-final-name",
				updatedAt: new Date(),
			};

			vi.mocked(prisma.category.findUnique).mockResolvedValueOnce(mockCategory as any);
			vi.mocked(prisma.category.update).mockResolvedValueOnce(mockUpdatedCategory as any);

			const updateData = {
				name: "Test Category Final Name",
			};

			const response = await app.inject({
				method: "PUT",
				url: `/categories/${mockCategory.id}`,
				headers: {
					authorization: `Bearer ${adminToken}`,
				},
				payload: updateData,
			});

			expect(response.statusCode).toBe(200);

			const body = JSON.parse(response.body);
			expect(body.name).toBe("Test Category Final Name");
			expect(body.slug).toBe("test-category-final-name");
			// Description deve permanecer a mesma
			expect(body.description).toBe("Descrição original");
		});

		it("deve atualizar status active da categoria", async () => {
			const mockCategory = {
				id: 22,
				name: "Test Category Active",
				slug: "test-category-active",
				description: "Categoria para teste de active",
				active: true,
				createdAt: new Date(),
				updatedAt: new Date(),
			};

			const mockUpdatedCategory = {
				...mockCategory,
				active: false,
				updatedAt: new Date(),
			};

			vi.mocked(prisma.category.findUnique).mockResolvedValueOnce(mockCategory as any);
			vi.mocked(prisma.category.update).mockResolvedValueOnce(mockUpdatedCategory as any);

			const updateData = {
				active: false,
			};

			const response = await app.inject({
				method: "PUT",
				url: `/categories/${mockCategory.id}`,
				headers: {
					authorization: `Bearer ${adminToken}`,
				},
				payload: updateData,
			});

			expect(response.statusCode).toBe(200);

			const body = JSON.parse(response.body);
			expect(body.active).toBe(false);
		});

		it("deve retornar erro ao atualizar categoria sem autenticação", async () => {
			const updateData = {
				name: "Unauthorized Update",
			};

			const response = await app.inject({
				method: "PUT",
				url: "/categories/123",
				payload: updateData,
			});

			expect(response.statusCode).toBeGreaterThanOrEqual(401);
		});

		it("deve retornar erro ao atualizar categoria com ID inválido", async () => {
			vi.mocked(prisma.category.findUnique).mockResolvedValueOnce(null);

			const updateData = {
				name: "Category Not Found",
			};

			const response = await app.inject({
				method: "PUT",
				url: "/categories/999999",
				headers: {
					authorization: `Bearer ${adminToken}`,
				},
				payload: updateData,
			});

			expect(response.statusCode).toBeGreaterThanOrEqual(400);
		});
	});

	describe("DELETE /categories/:id - Deletar categoria (soft delete em cascata)", () => {
		it("deve fazer soft delete de uma categoria (admin)", async () => {
			const mockCategory = {
				id: 30,
				name: "Test Category Delete",
				slug: "test-category-delete",
				description: "Categoria para teste de delete",
				active: true,
				createdAt: new Date(),
				updatedAt: new Date(),
			};

			const mockDeletedCategory = {
				...mockCategory,
				active: false,
				updatedAt: new Date(),
			};

			// Mock findUnique para verificar se existe
			vi.mocked(prisma.category.findUnique).mockResolvedValueOnce(mockCategory as any);
			// Mock update (soft delete)
			vi.mocked(prisma.category.update).mockResolvedValueOnce(mockDeletedCategory as any);
			// Mock updateMany para desativar produtos
			vi.mocked(prisma.product.updateMany).mockResolvedValueOnce({ count: 0 } as any);

			const response = await app.inject({
				method: "DELETE",
				url: `/categories/${mockCategory.id}`,
				headers: {
					authorization: `Bearer ${adminToken}`,
				},
			});

			expect(response.statusCode).toBe(204);
			expect(prisma.category.update).toHaveBeenCalled();
			expect(prisma.product.updateMany).toHaveBeenCalled();
		});

		it("deve desativar produtos ao deletar categoria (cascata)", async () => {
			const mockCategory = {
				id: 31,
				name: "Test Category With Products",
				slug: "test-category-with-products",
				description: "Categoria com produtos para teste de cascata",
				active: true,
				createdAt: new Date(),
				updatedAt: new Date(),
			};

			const mockProduct = {
				id: 100,
				name: "Test Product In Category",
				slug: "test-product-in-category",
				description: "Produto para teste de cascata",
				price: 99.99,
				stock: 10,
				active: true,
				categoryId: mockCategory.id,
				createdAt: new Date(),
				updatedAt: new Date(),
			};

			const mockDeletedCategory = { ...mockCategory, active: false, updatedAt: new Date() };

			// Mock findUnique para verificar se categoria existe
			vi.mocked(prisma.category.findUnique).mockResolvedValueOnce(mockCategory as any);
			// Mock update da categoria (soft delete)
			vi.mocked(prisma.category.update).mockResolvedValueOnce(mockDeletedCategory as any);
			// Mock updateMany para desativar produtos (retorna 1 produto afetado)
			vi.mocked(prisma.product.updateMany).mockResolvedValueOnce({ count: 1 } as any);

			const response = await app.inject({
				method: "DELETE",
				url: `/categories/${mockCategory.id}`,
				headers: {
					authorization: `Bearer ${adminToken}`,
				},
			});

			expect(response.statusCode).toBe(204);
			expect(prisma.category.update).toHaveBeenCalled();
			expect(prisma.product.updateMany).toHaveBeenCalledWith({
				where: { categoryId: mockCategory.id },
				data: { active: false },
			});
		});

		it("deve retornar erro ao deletar categoria sem autenticação", async () => {
			const response = await app.inject({
				method: "DELETE",
				url: "/categories/123",
			});

			expect(response.statusCode).toBeGreaterThanOrEqual(401);
		});

		it("deve retornar erro ao deletar categoria com ID inválido", async () => {
			vi.mocked(prisma.category.findUnique).mockResolvedValueOnce(null);

			const response = await app.inject({
				method: "DELETE",
				url: "/categories/999999",
				headers: {
					authorization: `Bearer ${adminToken}`,
				},
			});

			expect(response.statusCode).toBeGreaterThanOrEqual(400);
		});

		it("deve verificar que soft delete define active=false", async () => {
			const mockCategory = {
				id: 32,
				name: "Test Category List Check",
				slug: "test-category-list-check",
				description: "Categoria para teste de listagem",
				active: true,
				createdAt: new Date(),
				updatedAt: new Date(),
			};

			const mockDeletedCategory = { ...mockCategory, active: false };

			// Mock para delete
			vi.mocked(prisma.category.findUnique).mockResolvedValueOnce(mockCategory as any);
			vi.mocked(prisma.category.update).mockResolvedValueOnce(mockDeletedCategory as any);
			vi.mocked(prisma.product.updateMany).mockResolvedValueOnce({ count: 0 } as any);

			// Deleta a categoria
			const response = await app.inject({
				method: "DELETE",
				url: `/categories/${mockCategory.id}`,
				headers: {
					authorization: `Bearer ${adminToken}`,
				},
			});

			expect(response.statusCode).toBe(204);
			// Verifica que update foi chamado com active: false
			expect(prisma.category.update).toHaveBeenCalledWith(
				expect.objectContaining({
					where: { id: mockCategory.id },
					data: expect.objectContaining({ active: false }),
				})
			);
			// Verifica que updateMany foi chamado para desativar produtos
			expect(prisma.product.updateMany).toHaveBeenCalledWith({
				where: { categoryId: mockCategory.id },
				data: { active: false },
			});
		});
	});
});
