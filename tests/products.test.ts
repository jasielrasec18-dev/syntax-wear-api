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

describe("Products CRUD", () => {
	let app: FastifyInstance;
	let adminToken: string;
	let testCategoryId: number;
	let mockAdminUser: any;
	let mockCategory: any;

	beforeAll(async () => {
		app = await buildApp();

		const adminEmail = `admin-products-${Date.now()}@example.com`;
		const hashedPassword = "$2b$10$hashedpassword123";
		
		mockAdminUser = {
			id: 1,
			firstName: "Admin",
			lastName: "Products",
			email: adminEmail,
			password: hashedPassword,
			role: "ADMIN" as const,
			cpf: null,
			phone: null,
			birthDate: null,
			createdAt: new Date(),
			updatedAt: new Date(),
		};

		testCategoryId = 100;
		mockCategory = {
			id: testCategoryId,
			name: "Test Category",
			slug: "test-category",
			description: "Categoria para testes",
			active: true,
			createdAt: new Date(),
			updatedAt: new Date(),
		};

		// Mock para register: verifica se email existe
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
				lastName: "Products",
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

		// Mock permanente para verificação de token no middleware
		vi.mocked(prisma.user.findUnique).mockResolvedValue(mockAdminUser as any);
		
		// Mock permanente para buscar categoria
		vi.mocked(prisma.category.findUnique).mockResolvedValue(mockCategory as any);
	}, 15000);

	afterAll(async () => {
		await app.close();
	});

	describe("POST /products - Criar produto", () => {
		it("deve criar um novo produto com sucesso (admin)", async () => {
			const productData = {
				name: "Test Product 1",
				description: "Descrição do produto de teste",
				price: 99.99,
				categoryId: testCategoryId,
				stock: 10,
				slug: "test-product-1",
				active: true,
				colors: ["Preto", "Branco"],
				sizes: ["M", "G", "GG"],
				images: ["https://example.com/image1.jpg"],
			};

			const mockProduct = {
				id: 1,
				name: productData.name,
				slug: "test-product-1",
				description: productData.description,
				price: productData.price,
				stock: productData.stock,
				colors: productData.colors,
				sizes: productData.sizes,
				images: productData.images,
				active: true,
				categoryId: testCategoryId,
				createdAt: new Date(),
				updatedAt: new Date(),
			};

			// Mock da criação
			vi.mocked(prisma.product.create).mockResolvedValueOnce(mockProduct as any);

			const response = await app.inject({
				method: "POST",
				url: "/products",
				headers: {
					authorization: `Bearer ${adminToken}`,
				},
				payload: productData,
			});

			expect(response.statusCode).toBe(201);

			const body = JSON.parse(response.body);
			expect(body).toHaveProperty("message");
			expect(body.message).toBe("Produto criado com sucesso");
			expect(prisma.product.create).toHaveBeenCalled();
		});

		it("deve retornar erro ao criar produto sem autenticação", async () => {
			const productData = {
				name: "Test Product Unauthorized",
				description: "Produto não autorizado",
				price: 50.0,
				categoryId: testCategoryId,
				slug: "test-product-unauthorized",
				active: true,
				stock: 10,
			};

			const response = await app.inject({
				method: "POST",
				url: "/products",
				payload: productData,
			});

			expect(response.statusCode).toBeGreaterThanOrEqual(401);
			// Não deve chamar o Prisma pois falha na autenticação antes
		});

		it("deve retornar erro ao criar produto sem campos obrigatórios", async () => {
			const productData = {
				name: "Test Product Incomplete",
				// Faltando description, price, categoryId, slug, stock e active
			};

			const response = await app.inject({
				method: "POST",
				url: "/products",
				headers: {
					authorization: `Bearer ${adminToken}`,
				},
				payload: productData,
			});

			expect(response.statusCode).toBe(400);
			// Não deve chamar o Prisma pois falha na validação antes
		});

		it("deve retornar erro ao criar produto com categoryId inválido", async () => {
			// Mock categoria não encontrada
			vi.mocked(prisma.category.findUnique).mockResolvedValueOnce(null);

			const productData = {
				name: "Test Product Invalid Category",
				description: "Produto com categoria inválida",
				price: 99.99,
				categoryId: 999999, // ID que não existe
				slug: "test-product-invalid-category",
				active: true,
				stock: 10,
			};

			const response = await app.inject({
				method: "POST",
				url: "/products",
				headers: {
					authorization: `Bearer ${adminToken}`,
				},
				payload: productData,
			});

			expect(response.statusCode).toBeGreaterThanOrEqual(400);
			
			// Restaura mock padrão da categoria
			vi.mocked(prisma.category.findUnique).mockResolvedValue(mockCategory as any);
		});
	});

	describe("GET /products - Listar produtos", () => {
		it("deve listar produtos sem autenticação", async () => {
			const mockProducts = [
				{
					id: 1,
					name: "Produto 1",
					slug: "produto-1",
					description: "Descrição 1",
					price: 99.99,
					stock: 10,
					active: true,
					categoryId: testCategoryId,
					colors: null,
					sizes: null,
					images: null,
					createdAt: new Date(),
					updatedAt: new Date(),
				},
			];

			vi.mocked(prisma.product.findMany).mockResolvedValueOnce(mockProducts as any);
			vi.mocked(prisma.product.count).mockResolvedValueOnce(1);

			const response = await app.inject({
				method: "GET",
				url: "/products",
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

		it("deve listar produtos com paginação", async () => {
			const mockProducts = [
				{ id: 1, name: "Prod 1", slug: "prod-1", description: "Desc", price: 50, stock: 5, active: true, categoryId: testCategoryId, colors: null, sizes: null, images: null, createdAt: new Date(), updatedAt: new Date() },
				{ id: 2, name: "Prod 2", slug: "prod-2", description: "Desc", price: 60, stock: 5, active: true, categoryId: testCategoryId, colors: null, sizes: null, images: null, createdAt: new Date(), updatedAt: new Date() },
			];

			vi.mocked(prisma.product.findMany).mockResolvedValueOnce(mockProducts.slice(0, 5) as any);
			vi.mocked(prisma.product.count).mockResolvedValueOnce(10);

			const response = await app.inject({
				method: "GET",
				url: "/products?page=1&limit=5",
			});

			expect(response.statusCode).toBe(200);

			const body = JSON.parse(response.body);
			expect(body.page).toBe(1);
			expect(body.limit).toBe(5);
			expect(body.data.length).toBeLessThanOrEqual(5);
		});

		it("deve filtrar produtos por preço mínimo e máximo", async () => {
			const mockProducts = [
				{ id: 1, name: "Prod 1", slug: "prod-1", description: "Desc", price: 75, stock: 5, active: true, categoryId: testCategoryId, colors: null, sizes: null, images: null, createdAt: new Date(), updatedAt: new Date() },
				{ id: 2, name: "Prod 2", slug: "prod-2", description: "Desc", price: 100, stock: 5, active: true, categoryId: testCategoryId, colors: null, sizes: null, images: null, createdAt: new Date(), updatedAt: new Date() },
			];

			vi.mocked(prisma.product.findMany).mockResolvedValueOnce(mockProducts as any);
			vi.mocked(prisma.product.count).mockResolvedValueOnce(2);

			const response = await app.inject({
				method: "GET",
				url: "/products?minPrice=50&maxPrice=150",
			});

			expect(response.statusCode).toBe(200);

			const body = JSON.parse(response.body);
			body.data.forEach((product: any) => {
				expect(Number(product.price)).toBeGreaterThanOrEqual(50);
				expect(Number(product.price)).toBeLessThanOrEqual(150);
			});
		});

		it("deve buscar produtos por nome", async () => {
			const mockProducts = [
				{ id: 1, name: "Test Product 1", slug: "test-product-1", description: "Desc", price: 50, stock: 5, active: true, categoryId: testCategoryId, colors: null, sizes: null, images: null, createdAt: new Date(), updatedAt: new Date() },
			];

			vi.mocked(prisma.product.findMany).mockResolvedValueOnce(mockProducts as any);
			vi.mocked(prisma.product.count).mockResolvedValueOnce(1);

			const response = await app.inject({
				method: "GET",
				url: "/products?search=Test Product",
			});

			expect(response.statusCode).toBe(200);

			const body = JSON.parse(response.body);
			// Verifica que retornou ao menos uma lista (pode estar vazia)
			expect(Array.isArray(body.data)).toBe(true);
		});

		it("deve filtrar produtos por categoria", async () => {
			const mockProducts = [
				{ id: 1, name: "Prod Cat", slug: "prod-cat", description: "Desc", price: 50, stock: 5, active: true, categoryId: testCategoryId, colors: null, sizes: null, images: null, createdAt: new Date(), updatedAt: new Date() },
			];

			vi.mocked(prisma.product.findMany).mockResolvedValueOnce(mockProducts as any);
			vi.mocked(prisma.product.count).mockResolvedValueOnce(1);

			const response = await app.inject({
				method: "GET",
				url: `/products?categoryId=${testCategoryId}`,
			});

			expect(response.statusCode).toBe(200);

			const body = JSON.parse(response.body);
			body.data.forEach((product: any) => {
				expect(product.categoryId).toBe(testCategoryId);
			});
		});

		it("deve ordenar produtos por preço", async () => {
			const mockProducts = [
				{ id: 1, name: "Prod 1", slug: "prod-1", description: "Desc", price: 50, stock: 5, active: true, categoryId: testCategoryId, colors: null, sizes: null, images: null, createdAt: new Date(), updatedAt: new Date() },
				{ id: 2, name: "Prod 2", slug: "prod-2", description: "Desc", price: 100, stock: 5, active: true, categoryId: testCategoryId, colors: null, sizes: null, images: null, createdAt: new Date(), updatedAt: new Date() },
			];

			vi.mocked(prisma.product.findMany).mockResolvedValueOnce(mockProducts as any);
			vi.mocked(prisma.product.count).mockResolvedValueOnce(2);

			const response = await app.inject({
				method: "GET",
				url: "/products?sortBy=price&sortOrder=asc",
			});

			expect(response.statusCode).toBe(200);

			const body = JSON.parse(response.body);
			if (body.data.length > 1) {
				for (let i = 0; i < body.data.length - 1; i++) {
					expect(Number(body.data[i].price)).toBeLessThanOrEqual(
						Number(body.data[i + 1].price)
					);
				}
			}
		});
	});

	describe("GET /products/:id - Obter produto por ID", () => {
		it("deve obter um produto pelo ID", async () => {
			const mockProduct = {
				id: 10,
				name: "Test Product Get",
				slug: "test-product-get",
				description: "Produto para teste de GET",
				price: 79.99,
				stock: 5,
				active: true,
				categoryId: testCategoryId,
				colors: null,
				sizes: null,
				images: null,
				createdAt: new Date(),
				updatedAt: new Date(),
				category: mockCategory,
			};

			vi.mocked(prisma.product.findUnique).mockResolvedValueOnce(mockProduct as any);

			const response = await app.inject({
				method: "GET",
				url: `/products/${mockProduct.id}`,
			});

			expect(response.statusCode).toBe(200);

			const body = JSON.parse(response.body);
			expect(body).toHaveProperty("id");
			expect(body.id).toBe(mockProduct.id);
			expect(body).toHaveProperty("name");
			expect(body).toHaveProperty("price");
			expect(body).toHaveProperty("category");
			expect(body.category).toHaveProperty("id");
			expect(body.category.id).toBe(testCategoryId);
		});

		it("deve retornar erro ao buscar produto com ID inválido", async () => {
			vi.mocked(prisma.product.findUnique).mockResolvedValueOnce(null);

			const response = await app.inject({
				method: "GET",
				url: "/products/999999",
			});

			expect(response.statusCode).toBeGreaterThanOrEqual(400);
		});
	});

	describe("PUT /products/:id - Atualizar produto", () => {
		it("deve atualizar um produto com sucesso (admin)", async () => {
			const mockProduct = {
				id: 20,
				name: "Test Product Update",
				slug: "test-product-update",
				description: "Produto para teste de update",
				price: 99.99,
				stock: 10,
				active: true,
				categoryId: testCategoryId,
				colors: null,
				sizes: null,
				images: null,
				createdAt: new Date(),
				updatedAt: new Date(),
			};

			const mockUpdatedProduct = {
				...mockProduct,
				name: "Test Product Updated",
				slug: "test-product-updated",
				price: 149.99,
				stock: 20,
				updatedAt: new Date(),
			};

			vi.mocked(prisma.product.findUnique).mockResolvedValueOnce(mockProduct as any);
			vi.mocked(prisma.product.update).mockResolvedValueOnce(mockUpdatedProduct as any);

			const updateData = {
				name: "Test Product Updated",
				price: 149.99,
				stock: 20,
			};

			const response = await app.inject({
				method: "PUT",
				url: `/products/${mockProduct.id}`,
				headers: {
					authorization: `Bearer ${adminToken}`,
				},
				payload: updateData,
			});

			expect(response.statusCode).toBe(200);

			const body = JSON.parse(response.body);
			expect(body.name).toBe("Test Product Updated");
			expect(body.slug).toBe("test-product-updated");
			expect(Number(body.price)).toBe(149.99);
			expect(prisma.product.update).toHaveBeenCalled();
		});

		it("deve retornar erro ao atualizar produto sem autenticação", async () => {
			const updateData = {
				name: "Unauthorized Update",
			};

			const response = await app.inject({
				method: "PUT",
				url: "/products/123",
				payload: updateData,
			});

			expect(response.statusCode).toBeGreaterThanOrEqual(401);
		});

		it("deve retornar erro ao atualizar produto com ID inválido", async () => {
			vi.mocked(prisma.product.findUnique).mockResolvedValueOnce(null);

			const updateData = {
				name: "Product Not Found",
			};

			const response = await app.inject({
				method: "PUT",
				url: "/products/999999",
				headers: {
					authorization: `Bearer ${adminToken}`,
				},
				payload: updateData,
			});

			expect(response.statusCode).toBeGreaterThanOrEqual(400);
		});

		it("deve atualizar apenas campos específicos", async () => {
			const mockProduct = {
				id: 21,
				name: "Test Product Partial",
				slug: "test-product-partial",
				description: "Produto para teste de update parcial",
				price: 100.0,
				stock: 15,
				active: true,
				categoryId: testCategoryId,
				colors: null,
				sizes: null,
				images: null,
				createdAt: new Date(),
				updatedAt: new Date(),
			};

			const mockUpdatedProduct = {
				...mockProduct,
				stock: 50,
				updatedAt: new Date(),
			};

			vi.mocked(prisma.product.findUnique).mockResolvedValueOnce(mockProduct as any);
			vi.mocked(prisma.product.update).mockResolvedValueOnce(mockUpdatedProduct as any);

			const updateData = {
				stock: 50,
			};

			const response = await app.inject({
				method: "PUT",
				url: `/products/${mockProduct.id}`,
				headers: {
					authorization: `Bearer ${adminToken}`,
				},
				payload: updateData,
			});

			expect(response.statusCode).toBe(200);

			const body = JSON.parse(response.body);
			expect(body.stock).toBe(50);
			// Nome deve permanecer o mesmo
			expect(body.name).toBe(mockProduct.name);
		});
	});

	describe("DELETE /products/:id - Deletar produto (soft delete)", () => {
		it("deve fazer soft delete de um produto (admin)", async () => {
			const mockProduct = {
				id: 30,
				name: "Test Product Delete",
				slug: "test-product-delete",
				description: "Produto para teste de delete",
				price: 89.99,
				stock: 8,
				active: true,
				categoryId: testCategoryId,
				colors: null,
				sizes: null,
				images: null,
				createdAt: new Date(),
				updatedAt: new Date(),
			};

			const mockDeletedProduct = {
				...mockProduct,
				active: false,
				updatedAt: new Date(),
			};

			vi.mocked(prisma.product.findUnique).mockResolvedValueOnce(mockProduct as any);
			vi.mocked(prisma.product.update).mockResolvedValueOnce(mockDeletedProduct as any);

			const response = await app.inject({
				method: "DELETE",
				url: `/products/${mockProduct.id}`,
				headers: {
					authorization: `Bearer ${adminToken}`,
				},
			});

			expect(response.statusCode).toBe(204);
			expect(prisma.product.update).toHaveBeenCalled();
		});

		it("deve retornar erro ao deletar produto sem autenticação", async () => {
			const response = await app.inject({
				method: "DELETE",
				url: "/products/123",
			});

			expect(response.statusCode).toBeGreaterThanOrEqual(401);
		});

		it("deve retornar erro ao deletar produto com ID inválido", async () => {
			vi.mocked(prisma.product.findUnique).mockResolvedValueOnce(null);

			const response = await app.inject({
				method: "DELETE",
				url: "/products/999999",
				headers: {
					authorization: `Bearer ${adminToken}`,
				},
			});

			expect(response.statusCode).toBeGreaterThanOrEqual(400);
		});

		it("deve verificar que soft delete define active=false", async () => {
			const mockProduct = {
				id: 31,
				name: "Test Product List Check",
				slug: "test-product-list-check",
				description: "Produto para testar listagem",
				price: 45.0,
				stock: 2,
				active: true,
				categoryId: testCategoryId,
				colors: null,
				sizes: null,
				images: null,
				createdAt: new Date(),
				updatedAt: new Date(),
			};

			const mockDeletedProduct = { ...mockProduct, active: false };

			// Mock para delete
			vi.mocked(prisma.product.findUnique).mockResolvedValueOnce(mockProduct as any);
			vi.mocked(prisma.product.update).mockResolvedValueOnce(mockDeletedProduct as any);

			// Deleta o produto
			const response = await app.inject({
				method: "DELETE",
				url: `/products/${mockProduct.id}`,
				headers: {
					authorization: `Bearer ${adminToken}`,
				},
			});

			expect(response.statusCode).toBe(204);
			// Verifica que update foi chamado com active: false
			expect(prisma.product.update).toHaveBeenCalledWith(
				expect.objectContaining({
					where: { id: mockProduct.id },
					data: expect.objectContaining({ active: false }),
				})
			);
		});
	});
});
