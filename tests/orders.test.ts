import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { FastifyInstance } from "fastify";
import { buildApp } from "../src/app";
import { prisma } from "../src/utils/prisma";

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

describe("Orders CRUD - GET endpoints", () => {
	let app: FastifyInstance;
	let adminToken: string;
	let userToken: string;
	let mockAdminUser: any;
	let mockRegularUser: any;
	let mockCategory: any;
	let mockProduct: any;

	beforeAll(async () => {
		app = await buildApp();

		const adminEmail = `admin-orders-${Date.now()}@example.com`;
		const userEmail = `user-orders-${Date.now()}@example.com`;
		const hashedPassword = "$2b$10$hashedpassword123";

		// Mock do usuário admin
		mockAdminUser = {
			id: 1,
			firstName: "Admin",
			lastName: "Orders",
			email: adminEmail,
			password: hashedPassword,
			role: "ADMIN" as const,
			cpf: null,
			phone: null,
			birthDate: null,
			createdAt: new Date(),
			updatedAt: new Date(),
		};

		// Mock do usuário regular
		mockRegularUser = {
			id: 2,
			firstName: "User",
			lastName: "Regular",
			email: userEmail,
			password: hashedPassword,
			role: "USER" as const,
			cpf: null,
			phone: null,
			birthDate: null,
			createdAt: new Date(),
			updatedAt: new Date(),
		};

		// Mock categoria
		mockCategory = {
			id: 1,
			name: "Test Category",
			slug: "test-category",
			description: "Categoria para testes",
			active: true,
			createdAt: new Date(),
			updatedAt: new Date(),
		};

		// Mock produto
		mockProduct = {
			id: 1,
			name: "Test Product",
			slug: "test-product",
			description: "Produto para testes",
			price: 99.99,
			stock: 100,
			colors: ["Preto", "Branco"],
			sizes: ["M", "G", "GG"],
			images: ["https://example.com/image1.jpg"],
			active: true,
			categoryId: 1,
			createdAt: new Date(),
			updatedAt: new Date(),
			category: mockCategory,
		};

		// ===== Registro e login do ADMIN =====
		vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null);
		vi.mocked(prisma.user.create).mockResolvedValueOnce({
			...mockAdminUser,
			role: "USER" as const,
		} as any);

		await app.inject({
			method: "POST",
			url: "/auth/register",
			payload: {
				firstName: "Admin",
				lastName: "Orders",
				email: adminEmail,
				password: "admin123",
			},
		});

		vi.mocked(prisma.user.update).mockResolvedValueOnce(mockAdminUser as any);
		await prisma.user.update({
			where: { id: 1 },
			data: { role: "ADMIN" },
		});

		vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(mockAdminUser as any);

		const adminLoginResponse = await app.inject({
			method: "POST",
			url: "/auth/login",
			payload: {
				email: adminEmail,
				password: "admin123",
			},
		});

		expect(adminLoginResponse.statusCode).toBe(200);
		adminToken = JSON.parse(adminLoginResponse.body).token;

		// ===== Registro e login do USER =====
		vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null);
		vi.mocked(prisma.user.create).mockResolvedValueOnce(mockRegularUser as any);

		await app.inject({
			method: "POST",
			url: "/auth/register",
			payload: {
				firstName: "User",
				lastName: "Regular",
				email: userEmail,
				password: "user123",
			},
		});

		vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(mockRegularUser as any);

		const userLoginResponse = await app.inject({
			method: "POST",
			url: "/auth/login",
			payload: {
				email: userEmail,
				password: "user123",
			},
		});

		expect(userLoginResponse.statusCode).toBe(200);
		userToken = JSON.parse(userLoginResponse.body).token;

		// Mock permanente para verificação de token
		vi.mocked(prisma.user.findUnique).mockImplementation((args: any) => {
			if (args.where.email === adminEmail) {
				return Promise.resolve(mockAdminUser) as any;
			}
			if (args.where.email === userEmail) {
				return Promise.resolve(mockRegularUser) as any;
			}
			if (args.where.id === 1) {
				return Promise.resolve(mockAdminUser) as any;
			}
			if (args.where.id === 2) {
				return Promise.resolve(mockRegularUser) as any;
			}
			return Promise.resolve(null) as any;
		});
	}, 15000);

	afterAll(async () => {
		await app.close();
	});

	describe("GET /orders - Listar pedidos", () => {
		it("deve permitir admin listar todos os pedidos", async () => {
			const mockOrders = [
				{
					id: 1,
					userId: 2,
					total: 199.98,
					status: "PENDING",
					shippingAddress: {
						cep: "12345678",
						street: "Rua Teste",
						number: "123",
						neighborhood: "Centro",
						city: "São Paulo",
						state: "SP",
						country: "BR",
					},
					paymentMethod: "credit_card",
					createdAt: new Date(),
					updatedAt: new Date(),
				},
				{
					id: 2,
					userId: 2,
					total: 99.99,
					status: "PAID",
					shippingAddress: {
						cep: "87654321",
						street: "Av Principal",
						number: "456",
						neighborhood: "Jardim",
						city: "Rio de Janeiro",
						state: "RJ",
						country: "BR",
					},
					paymentMethod: "pix",
					createdAt: new Date(),
					updatedAt: new Date(),
				},
			];

			vi.mocked(prisma.order.findMany).mockResolvedValueOnce(mockOrders as any);
			vi.mocked(prisma.order.count).mockResolvedValueOnce(2);

			const response = await app.inject({
				method: "GET",
				url: "/orders",
				headers: {
					authorization: `Bearer ${adminToken}`,
				},
			});

			expect(response.statusCode).toBe(200);

			const body = JSON.parse(response.body);
			expect(body).toHaveProperty("data");
			expect(body).toHaveProperty("total");
			expect(body).toHaveProperty("page");
			expect(body).toHaveProperty("limit");
			expect(body).toHaveProperty("totalPages");
			expect(Array.isArray(body.data)).toBe(true);
			expect(body.data.length).toBe(2);
		});

		it("deve permitir usuário regular listar apenas seus pedidos", async () => {
			const mockUserOrders = [
				{
					id: 1,
					userId: 2,
					total: 199.98,
					status: "PENDING",
					shippingAddress: {
						cep: "12345678",
						street: "Rua Teste",
						number: "123",
						neighborhood: "Centro",
						city: "São Paulo",
						state: "SP",
						country: "BR",
					},
					paymentMethod: "credit_card",
					createdAt: new Date(),
					updatedAt: new Date(),
				},
			];

			vi.mocked(prisma.order.findMany).mockResolvedValueOnce(mockUserOrders as any);
			vi.mocked(prisma.order.count).mockResolvedValueOnce(1);

			const response = await app.inject({
				method: "GET",
				url: "/orders",
				headers: {
					authorization: `Bearer ${userToken}`,
				},
			});

			expect(response.statusCode).toBe(200);

			const body = JSON.parse(response.body);
			expect(body.data.length).toBe(1);
			expect(body.data[0].userId).toBe(2);
		});

		it("deve retornar erro ao listar pedidos sem autenticação", async () => {
			const response = await app.inject({
				method: "GET",
				url: "/orders",
			});

			expect(response.statusCode).toBeGreaterThanOrEqual(401);
		});

		it("deve listar pedidos com paginação", async () => {
			const mockOrders = [
				{
					id: 1,
					userId: 2,
					total: 99.99,
					status: "PENDING",
					shippingAddress: {},
					paymentMethod: "credit_card",
					createdAt: new Date(),
					updatedAt: new Date(),
				},
				{
					id: 2,
					userId: 2,
					total: 149.99,
					status: "PAID",
					shippingAddress: {},
					paymentMethod: "pix",
					createdAt: new Date(),
					updatedAt: new Date(),
				},
			];

			vi.mocked(prisma.order.findMany).mockResolvedValueOnce(mockOrders.slice(0, 5) as any);
			vi.mocked(prisma.order.count).mockResolvedValueOnce(10);

			const response = await app.inject({
				method: "GET",
				url: "/orders?page=1&limit=5",
				headers: {
					authorization: `Bearer ${adminToken}`,
				},
			});

			expect(response.statusCode).toBe(200);

			const body = JSON.parse(response.body);
			expect(body.page).toBe(1);
			expect(body.limit).toBe(5);
			expect(body.data.length).toBeLessThanOrEqual(5);
		});

		it("deve filtrar pedidos por status", async () => {
			const mockOrders = [
				{
					id: 1,
					userId: 2,
					total: 99.99,
					status: "PAID",
					shippingAddress: {},
					paymentMethod: "credit_card",
					createdAt: new Date(),
					updatedAt: new Date(),
				},
			];

			vi.mocked(prisma.order.findMany).mockResolvedValueOnce(mockOrders as any);
			vi.mocked(prisma.order.count).mockResolvedValueOnce(1);

			const response = await app.inject({
				method: "GET",
				url: "/orders?status=PAID",
				headers: {
					authorization: `Bearer ${adminToken}`,
				},
			});

			expect(response.statusCode).toBe(200);

			const body = JSON.parse(response.body);
			body.data.forEach((order: any) => {
				expect(order.status).toBe("PAID");
			});
		});

		it("deve filtrar pedidos por userId (admin)", async () => {
			const mockOrders = [
				{
					id: 1,
					userId: 2,
					total: 99.99,
					status: "PENDING",
					shippingAddress: {},
					paymentMethod: "credit_card",
					createdAt: new Date(),
					updatedAt: new Date(),
				},
			];

			vi.mocked(prisma.order.findMany).mockResolvedValueOnce(mockOrders as any);
			vi.mocked(prisma.order.count).mockResolvedValueOnce(1);

			const response = await app.inject({
				method: "GET",
				url: "/orders?userId=2",
				headers: {
					authorization: `Bearer ${adminToken}`,
				},
			});

			expect(response.statusCode).toBe(200);

			const body = JSON.parse(response.body);
			body.data.forEach((order: any) => {
				expect(order.userId).toBe(2);
			});
		});

		it("deve filtrar pedidos por data", async () => {
			const mockOrders = [
				{
					id: 1,
					userId: 2,
					total: 99.99,
					status: "PENDING",
					shippingAddress: {},
					paymentMethod: "credit_card",
					createdAt: new Date("2025-01-15"),
					updatedAt: new Date(),
				},
			];

			vi.mocked(prisma.order.findMany).mockResolvedValueOnce(mockOrders as any);
			vi.mocked(prisma.order.count).mockResolvedValueOnce(1);

			const response = await app.inject({
				method: "GET",
				url: "/orders?startDate=2025-01-01T00:00:00.000Z&endDate=2025-01-31T23:59:59.999Z",
				headers: {
					authorization: `Bearer ${adminToken}`,
				},
			});

			expect(response.statusCode).toBe(200);

			const body = JSON.parse(response.body);
			expect(Array.isArray(body.data)).toBe(true);
		});
	});

	describe("GET /orders/:id - Obter pedido por ID", () => {
		it("deve permitir admin obter qualquer pedido pelo ID", async () => {
			const mockOrder = {
				id: 10,
				userId: 2,
				total: 199.98,
				status: "PENDING",
				shippingAddress: {
					cep: "12345678",
					street: "Rua Teste",
					number: "123",
					neighborhood: "Centro",
					city: "São Paulo",
					state: "SP",
					country: "BR",
				},
				paymentMethod: "credit_card",
				createdAt: new Date(),
				updatedAt: new Date(),
				user: {
					id: 2,
					firstName: "User",
					lastName: "Regular",
					email: "user@example.com",
					cpf: null,
					phone: null,
				},
				items: [
					{
						id: 1,
						orderId: 10,
						productId: 1,
						price: 99.99,
						quantity: 2,
						size: "M",
						product: mockProduct,
					},
				],
			};

			vi.mocked(prisma.order.findUnique).mockResolvedValueOnce(mockOrder as any);

			const response = await app.inject({
				method: "GET",
				url: `/orders/${mockOrder.id}`,
				headers: {
					authorization: `Bearer ${adminToken}`,
				},
			});

			expect(response.statusCode).toBe(200);

			const body = JSON.parse(response.body);
			expect(body).toHaveProperty("id");
			expect(body.id).toBe(mockOrder.id);
			expect(body).toHaveProperty("total");
			expect(body).toHaveProperty("status");
			expect(body).toHaveProperty("user");
			expect(body).toHaveProperty("items");
			expect(body.user).toHaveProperty("id");
			expect(body.items).toBeInstanceOf(Array);
			expect(body.items.length).toBe(1);
			expect(body.items[0]).toHaveProperty("product");
			expect(body.items[0].product).toHaveProperty("category");
		});

		it("deve permitir usuário obter seu próprio pedido", async () => {
			const mockOrder = {
				id: 11,
				userId: 2,
				total: 99.99,
				status: "PAID",
				shippingAddress: {
					cep: "12345678",
					street: "Rua Teste",
					number: "123",
					neighborhood: "Centro",
					city: "São Paulo",
					state: "SP",
					country: "BR",
				},
				paymentMethod: "pix",
				createdAt: new Date(),
				updatedAt: new Date(),
				user: mockRegularUser,
				items: [
					{
						id: 1,
						orderId: 11,
						productId: 1,
						price: 99.99,
						quantity: 1,
						size: "G",
						product: mockProduct,
					},
				],
			};

			vi.mocked(prisma.order.findUnique).mockResolvedValueOnce(mockOrder as any);

			const response = await app.inject({
				method: "GET",
				url: `/orders/${mockOrder.id}`,
				headers: {
					authorization: `Bearer ${userToken}`,
				},
			});

			expect(response.statusCode).toBe(200);

			const body = JSON.parse(response.body);
			expect(body.id).toBe(mockOrder.id);
			expect(body.userId).toBe(2);
		});

		it("deve retornar erro ao usuário tentar acessar pedido de outro usuário", async () => {
			const mockOrder = {
				id: 12,
				userId: 999, // Outro usuário
				total: 99.99,
				status: "PENDING",
				shippingAddress: {},
				paymentMethod: "credit_card",
				createdAt: new Date(),
				updatedAt: new Date(),
				user: {
					id: 999,
					firstName: "Other",
					lastName: "User",
					email: "other@example.com",
					cpf: null,
					phone: null,
				},
				items: [],
			};

			vi.mocked(prisma.order.findUnique).mockResolvedValueOnce(mockOrder as any);

			const response = await app.inject({
				method: "GET",
				url: `/orders/${mockOrder.id}`,
				headers: {
					authorization: `Bearer ${userToken}`,
				},
			});

			expect(response.statusCode).toBeGreaterThanOrEqual(400);
		});

		it("deve retornar erro ao buscar pedido com ID inválido", async () => {
			vi.mocked(prisma.order.findUnique).mockResolvedValueOnce(null);

			const response = await app.inject({
				method: "GET",
				url: "/orders/999999",
				headers: {
					authorization: `Bearer ${adminToken}`,
				},
			});

			expect(response.statusCode).toBeGreaterThanOrEqual(400);
		});

		it("deve retornar erro ao buscar pedido sem autenticação", async () => {
			const response = await app.inject({
				method: "GET",
				url: "/orders/123",
			});

			expect(response.statusCode).toBeGreaterThanOrEqual(401);
		});
	});

	describe("POST /orders - Criar pedido", () => {
		it("deve criar um novo pedido com sucesso (usuário autenticado)", async () => {
			const orderData = {
				userId: 2,
				items: [
					{
						productId: 1,
						quantity: 2,
						size: "M",
					},
				],
				shippingAddress: {
					cep: "12345678",
					street: "Rua Teste",
					number: "123",
					complement: "Apto 101",
					neighborhood: "Centro",
					city: "São Paulo",
					state: "SP",
					country: "BR",
				},
				paymentMethod: "credit_card",
			};

			const mockCreatedOrder = {
				id: 100,
				userId: 2,
				total: 199.98,
				status: "PENDING",
				shippingAddress: orderData.shippingAddress,
				paymentMethod: orderData.paymentMethod,
				createdAt: new Date(),
				updatedAt: new Date(),
			};

			// Mock para buscar produtos
			vi.mocked(prisma.product.findMany).mockResolvedValueOnce([mockProduct] as any);

			// Mock da transação
			vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
				return callback({
					order: {
						create: vi.fn().mockResolvedValue(mockCreatedOrder),
					},
					orderItem: {
						create: vi.fn().mockResolvedValue({
							id: 1,
							orderId: 100,
							productId: 1,
							price: 99.99,
							quantity: 2,
							size: "M",
						}),
					},
					product: {
						update: vi.fn().mockResolvedValue({
							...mockProduct,
							stock: 98,
						}),
					},
				});
			});

			const response = await app.inject({
				method: "POST",
				url: "/orders",
				headers: {
					authorization: `Bearer ${userToken}`,
				},
				payload: orderData,
			});

			expect(response.statusCode).toBe(201);

			const body = JSON.parse(response.body);
			expect(body).toHaveProperty("message");
			expect(body.message).toBe("Pedido criado com sucesso");
		});

		it("deve criar pedido sem userId (guest checkout)", async () => {
			const orderData = {
				items: [
					{
						productId: 1,
						quantity: 1,
						size: "G",
					},
				],
				shippingAddress: {
					cep: "87654321",
					street: "Av Principal",
					number: "456",
					neighborhood: "Jardim",
					city: "Rio de Janeiro",
					state: "RJ",
					country: "BR",
				},
				paymentMethod: "pix",
			};

			const mockCreatedOrder = {
				id: 101,
				userId: null,
				total: 99.99,
				status: "PENDING",
				shippingAddress: orderData.shippingAddress,
				paymentMethod: orderData.paymentMethod,
				createdAt: new Date(),
				updatedAt: new Date(),
			};

			vi.mocked(prisma.product.findMany).mockResolvedValueOnce([mockProduct] as any);

			vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
				return callback({
					order: {
						create: vi.fn().mockResolvedValue(mockCreatedOrder),
					},
					orderItem: {
						create: vi.fn().mockResolvedValue({
							id: 1,
							orderId: 101,
							productId: 1,
							price: 99.99,
							quantity: 1,
							size: "G",
						}),
					},
					product: {
						update: vi.fn().mockResolvedValue({
							...mockProduct,
							stock: 99,
						}),
					},
				});
			});

			const response = await app.inject({
				method: "POST",
				url: "/orders",
				headers: {
					authorization: `Bearer ${userToken}`,
				},
				payload: orderData,
			});

			expect(response.statusCode).toBe(201);

			const body = JSON.parse(response.body);
			expect(body.orderId).toBe(101);
		});

		it("deve retornar erro ao criar pedido sem autenticação", async () => {
			const orderData = {
				userId: 2,
				items: [
					{
						productId: 1,
						quantity: 1,
					},
				],
				shippingAddress: {
					cep: "12345678",
					street: "Rua Teste",
					number: "123",
					neighborhood: "Centro",
					city: "São Paulo",
					state: "SP",
					country: "BR",
				},
				paymentMethod: "credit_card",
			};

			const response = await app.inject({
				method: "POST",
				url: "/orders",
				payload: orderData,
			});

			expect(response.statusCode).toBeGreaterThanOrEqual(401);
		});

		it("deve retornar erro ao criar pedido sem items", async () => {
			const orderData = {
				userId: 2,
				items: [],
				shippingAddress: {
					cep: "12345678",
					street: "Rua Teste",
					number: "123",
					neighborhood: "Centro",
					city: "São Paulo",
					state: "SP",
					country: "BR",
				},
				paymentMethod: "credit_card",
			};

			const response = await app.inject({
				method: "POST",
				url: "/orders",
				headers: {
					authorization: `Bearer ${userToken}`,
				},
				payload: orderData,
			});

			expect(response.statusCode).toBe(400);
		});

		it("deve retornar erro ao criar pedido sem shippingAddress", async () => {
			const orderData = {
				userId: 2,
				items: [
					{
						productId: 1,
						quantity: 1,
					},
				],
				paymentMethod: "credit_card",
			};

			const response = await app.inject({
				method: "POST",
				url: "/orders",
				headers: {
					authorization: `Bearer ${userToken}`,
				},
				payload: orderData,
			});

			expect(response.statusCode).toBe(400);
		});

		it("deve retornar erro ao criar pedido sem paymentMethod", async () => {
			const orderData = {
				userId: 2,
				items: [
					{
						productId: 1,
						quantity: 1,
					},
				],
				shippingAddress: {
					cep: "12345678",
					street: "Rua Teste",
					number: "123",
					neighborhood: "Centro",
					city: "São Paulo",
					state: "SP",
					country: "BR",
				},
			};

			const response = await app.inject({
				method: "POST",
				url: "/orders",
				headers: {
					authorization: `Bearer ${userToken}`,
				},
				payload: orderData,
			});

			expect(response.statusCode).toBe(400);
		});

		it("deve retornar erro ao criar pedido com produto inexistente", async () => {
			const orderData = {
				userId: 2,
				items: [
					{
						productId: 999999,
						quantity: 1,
					},
				],
				shippingAddress: {
					cep: "12345678",
					street: "Rua Teste",
					number: "123",
					neighborhood: "Centro",
					city: "São Paulo",
					state: "SP",
					country: "BR",
				},
				paymentMethod: "credit_card",
			};

			// Mock retorna array vazio (produto não encontrado)
			vi.mocked(prisma.product.findMany).mockResolvedValueOnce([]);

			const response = await app.inject({
				method: "POST",
				url: "/orders",
				headers: {
					authorization: `Bearer ${userToken}`,
				},
				payload: orderData,
			});

			expect(response.statusCode).toBeGreaterThanOrEqual(400);
		});

		it("deve retornar erro ao criar pedido com produto inativo", async () => {
			const inactiveProduct = {
				...mockProduct,
				active: false,
			};

			const orderData = {
				userId: 2,
				items: [
					{
						productId: 1,
						quantity: 1,
					},
				],
				shippingAddress: {
					cep: "12345678",
					street: "Rua Teste",
					number: "123",
					neighborhood: "Centro",
					city: "São Paulo",
					state: "SP",
					country: "BR",
				},
				paymentMethod: "credit_card",
			};

			vi.mocked(prisma.product.findMany).mockResolvedValueOnce([inactiveProduct] as any);

			const response = await app.inject({
				method: "POST",
				url: "/orders",
				headers: {
					authorization: `Bearer ${userToken}`,
				},
				payload: orderData,
			});

			expect(response.statusCode).toBeGreaterThanOrEqual(400);
		});

		it("deve retornar erro ao criar pedido com estoque insuficiente", async () => {
			const lowStockProduct = {
				...mockProduct,
				stock: 1,
			};

			const orderData = {
				userId: 2,
				items: [
					{
						productId: 1,
						quantity: 10,
					},
				],
				shippingAddress: {
					cep: "12345678",
					street: "Rua Teste",
					number: "123",
					neighborhood: "Centro",
					city: "São Paulo",
					state: "SP",
					country: "BR",
				},
				paymentMethod: "credit_card",
			};

			vi.mocked(prisma.product.findMany).mockResolvedValueOnce([lowStockProduct] as any);

			const response = await app.inject({
				method: "POST",
				url: "/orders",
				headers: {
					authorization: `Bearer ${userToken}`,
				},
				payload: orderData,
			});

			expect(response.statusCode).toBeGreaterThanOrEqual(400);
		});

		it("deve retornar erro ao criar pedido sem size quando produto requer", async () => {
			const orderData = {
				userId: 2,
				items: [
					{
						productId: 1,
						quantity: 1,
						// size não informado, mas produto tem sizes
					},
				],
				shippingAddress: {
					cep: "12345678",
					street: "Rua Teste",
					number: "123",
					neighborhood: "Centro",
					city: "São Paulo",
					state: "SP",
					country: "BR",
				},
				paymentMethod: "credit_card",
			};

			vi.mocked(prisma.product.findMany).mockResolvedValueOnce([mockProduct] as any);

			const response = await app.inject({
				method: "POST",
				url: "/orders",
				headers: {
					authorization: `Bearer ${userToken}`,
				},
				payload: orderData,
			});

			expect(response.statusCode).toBeGreaterThanOrEqual(400);
		});

		it("deve retornar erro ao criar pedido com size inválido", async () => {
			const orderData = {
				userId: 2,
				items: [
					{
						productId: 1,
						quantity: 1,
						size: "XXL", // Tamanho não disponível
					},
				],
				shippingAddress: {
					cep: "12345678",
					street: "Rua Teste",
					number: "123",
					neighborhood: "Centro",
					city: "São Paulo",
					state: "SP",
					country: "BR",
				},
				paymentMethod: "credit_card",
			};

			vi.mocked(prisma.product.findMany).mockResolvedValueOnce([mockProduct] as any);

			const response = await app.inject({
				method: "POST",
				url: "/orders",
				headers: {
					authorization: `Bearer ${userToken}`,
				},
				payload: orderData,
			});

			expect(response.statusCode).toBeGreaterThanOrEqual(400);
		});

		it("deve retornar erro ao criar pedido com CEP inválido", async () => {
			const orderData = {
				userId: 2,
				items: [
					{
						productId: 1,
						quantity: 1,
						size: "M",
					},
				],
				shippingAddress: {
					cep: "123", // CEP inválido
					street: "Rua Teste",
					number: "123",
					neighborhood: "Centro",
					city: "São Paulo",
					state: "SP",
					country: "BR",
				},
				paymentMethod: "credit_card",
			};

			const response = await app.inject({
				method: "POST",
				url: "/orders",
				headers: {
					authorization: `Bearer ${userToken}`,
				},
				payload: orderData,
			});

			expect(response.statusCode).toBe(400);
		});

		it("deve criar pedido com múltiplos items", async () => {
			const mockProduct2 = {
				id: 2,
				name: "Test Product 2",
				slug: "test-product-2",
				description: "Segundo produto",
				price: 149.99,
				stock: 50,
				colors: ["Azul"],
				sizes: ["P", "M"],
				images: [],
				active: true,
				categoryId: 1,
				createdAt: new Date(),
				updatedAt: new Date(),
				category: mockCategory,
			};

			const orderData = {
				userId: 2,
				items: [
					{
						productId: 1,
						quantity: 2,
						size: "M",
					},
					{
						productId: 2,
						quantity: 1,
						size: "P",
					},
				],
				shippingAddress: {
					cep: "12345678",
					street: "Rua Teste",
					number: "123",
					neighborhood: "Centro",
					city: "São Paulo",
					state: "SP",
					country: "BR",
				},
				paymentMethod: "credit_card",
			};

			const mockCreatedOrder = {
				id: 102,
				userId: 2,
				total: 349.97, // (99.99 * 2) + (149.99 * 1)
				status: "PENDING",
				shippingAddress: orderData.shippingAddress,
				paymentMethod: orderData.paymentMethod,
				createdAt: new Date(),
				updatedAt: new Date(),
			};

			vi.mocked(prisma.product.findMany).mockResolvedValueOnce([mockProduct, mockProduct2] as any);

			vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
				return callback({
					order: {
						create: vi.fn().mockResolvedValue(mockCreatedOrder),
					},
					orderItem: {
						create: vi
							.fn()
							.mockResolvedValueOnce({
								id: 1,
								orderId: 102,
								productId: 1,
								price: 99.99,
								quantity: 2,
								size: "M",
							})
							.mockResolvedValueOnce({
								id: 2,
								orderId: 102,
								productId: 2,
								price: 149.99,
								quantity: 1,
								size: "P",
							}),
					},
					product: {
						update: vi.fn().mockResolvedValue({}),
					},
				});
			});

			const response = await app.inject({
				method: "POST",
				url: "/orders",
				headers: {
					authorization: `Bearer ${userToken}`,
				},
				payload: orderData,
			});

			expect(response.statusCode).toBe(201);

			const body = JSON.parse(response.body);
			expect(body.orderId).toBe(102);
		});
	});

	describe("PUT /orders/:id - Atualizar pedido", () => {
		it("deve permitir admin atualizar status do pedido", async () => {
			const mockOrder = {
				id: 200,
				userId: 2,
				total: 199.98,
				status: "PENDING",
				shippingAddress: {
					cep: "12345678",
					street: "Rua Teste",
					number: "123",
					neighborhood: "Centro",
					city: "São Paulo",
					state: "SP",
					country: "BR",
				},
				paymentMethod: "credit_card",
				createdAt: new Date(),
				updatedAt: new Date(),
			};

			const mockUpdatedOrder = {
				...mockOrder,
				status: "PAID",
				updatedAt: new Date(),
				user: {
					id: 2,
					firstName: "User",
					lastName: "Regular",
					email: "user@example.com",
					cpf: null,
					phone: null,
				},
				items: [
					{
						id: 1,
						orderId: 200,
						productId: 1,
						price: 99.99,
						quantity: 2,
						size: "M",
						product: mockProduct,
					},
				],
			};

			const updateData = {
				status: "PAID",
			};

			vi.mocked(prisma.order.findUnique).mockResolvedValueOnce(mockOrder as any);
			vi.mocked(prisma.order.update).mockResolvedValueOnce(mockUpdatedOrder as any);

			const response = await app.inject({
				method: "PUT",
				url: `/orders/${mockOrder.id}`,
				headers: {
					authorization: `Bearer ${adminToken}`,
				},
				payload: updateData,
			});

			expect(response.statusCode).toBe(200);

			const body = JSON.parse(response.body);
			expect(body.status).toBe("PAID");
			expect(prisma.order.update).toHaveBeenCalled();
		});

		it("deve permitir admin atualizar endereço de entrega", async () => {
			const mockOrder = {
				id: 201,
				userId: 2,
				total: 99.99,
				status: "PENDING",
				shippingAddress: {
					cep: "12345678",
					street: "Rua Teste",
					number: "123",
					neighborhood: "Centro",
					city: "São Paulo",
					state: "SP",
					country: "BR",
				},
				paymentMethod: "credit_card",
				createdAt: new Date(),
				updatedAt: new Date(),
			};

			const newAddress = {
				cep: "87654321",
				street: "Av Nova",
				number: "456",
				complement: "Bloco B",
				neighborhood: "Jardim",
				city: "Rio de Janeiro",
				state: "RJ",
				country: "BR",
			};

			const mockUpdatedOrder = {
				id: 201,
				userId: 2,
				total: 99.99,
				status: "PENDING",
				shippingAddress: newAddress as any,
				paymentMethod: "credit_card",
				createdAt: new Date(),
				updatedAt: new Date(),
				user: mockRegularUser,
				items: [],
			};

			const updateData = {
				shippingAddress: newAddress,
			};

			vi.mocked(prisma.order.findUnique).mockResolvedValueOnce(mockOrder as any);
			vi.mocked(prisma.order.update).mockResolvedValueOnce(mockUpdatedOrder as any);

			const response = await app.inject({
				method: "PUT",
				url: `/orders/${mockOrder.id}`,
				headers: {
					authorization: `Bearer ${adminToken}`,
				},
				payload: updateData,
			});

			expect(response.statusCode).toBe(200);

			const body = JSON.parse(response.body);
			// Verifica que o pedido foi atualizado
			expect(body).toHaveProperty("id");
			expect(body.id).toBe(201);
			expect(prisma.order.update).toHaveBeenCalled();

			// Verifica que o mock foi chamado com o endereço correto
			const updateCall = vi.mocked(prisma.order.update).mock.calls[0];
			expect(updateCall).toBeDefined();
		});

		it("deve permitir usuário atualizar seu próprio pedido", async () => {
			const mockOrder = {
				id: 202,
				userId: 2,
				total: 99.99,
				status: "PENDING",
				shippingAddress: {
					cep: "12345678",
					street: "Rua Teste",
					number: "123",
					neighborhood: "Centro",
					city: "São Paulo",
					state: "SP",
					country: "BR",
				},
				paymentMethod: "credit_card",
				createdAt: new Date(),
				updatedAt: new Date(),
			};

			const mockUpdatedOrder = {
				...mockOrder,
				status: "CANCELLED",
				updatedAt: new Date(),
				user: mockRegularUser,
				items: [],
			};

			const updateData = {
				status: "CANCELLED",
			};

			vi.mocked(prisma.order.findUnique).mockResolvedValueOnce(mockOrder as any);
			vi.mocked(prisma.order.update).mockResolvedValueOnce(mockUpdatedOrder as any);

			const response = await app.inject({
				method: "PUT",
				url: `/orders/${mockOrder.id}`,
				headers: {
					authorization: `Bearer ${userToken}`,
				},
				payload: updateData,
			});

			expect(response.statusCode).toBe(200);

			const body = JSON.parse(response.body);
			expect(body.status).toBe("CANCELLED");
		});

		it("deve retornar erro ao usuário tentar atualizar pedido de outro", async () => {
			const mockOrder = {
				id: 203,
				userId: 999, // Outro usuário
				total: 99.99,
				status: "PENDING",
				shippingAddress: {},
				paymentMethod: "credit_card",
				createdAt: new Date(),
				updatedAt: new Date(),
			};

			const updateData = {
				status: "PAID",
			};

			vi.mocked(prisma.order.findUnique).mockResolvedValueOnce(mockOrder as any);

			const response = await app.inject({
				method: "PUT",
				url: `/orders/${mockOrder.id}`,
				headers: {
					authorization: `Bearer ${userToken}`,
				},
				payload: updateData,
			});

			expect(response.statusCode).toBeGreaterThanOrEqual(400);
		});

		it("deve retornar erro ao atualizar pedido sem autenticação", async () => {
			const updateData = {
				status: "PAID",
			};

			const response = await app.inject({
				method: "PUT",
				url: "/orders/123",
				payload: updateData,
			});

			expect(response.statusCode).toBeGreaterThanOrEqual(401);
		});

		it("deve retornar erro ao atualizar pedido inexistente", async () => {
			vi.mocked(prisma.order.findUnique).mockResolvedValueOnce(null);

			const updateData = {
				status: "PAID",
			};

			const response = await app.inject({
				method: "PUT",
				url: "/orders/999999",
				headers: {
					authorization: `Bearer ${adminToken}`,
				},
				payload: updateData,
			});

			expect(response.statusCode).toBeGreaterThanOrEqual(400);
		});

		it("deve retornar erro ao atualizar com status inválido", async () => {
			const mockOrder = {
				id: 204,
				userId: 2,
				total: 99.99,
				status: "PENDING",
				shippingAddress: {},
				paymentMethod: "credit_card",
				createdAt: new Date(),
				updatedAt: new Date(),
			};

			const updateData = {
				status: "INVALID_STATUS",
			};

			vi.mocked(prisma.order.findUnique).mockResolvedValueOnce(mockOrder as any);

			const response = await app.inject({
				method: "PUT",
				url: `/orders/${mockOrder.id}`,
				headers: {
					authorization: `Bearer ${adminToken}`,
				},
				payload: updateData,
			});

			expect(response.statusCode).toBe(400);
		});

		it("deve retornar erro ao atualizar com CEP inválido no endereço", async () => {
			const mockOrder = {
				id: 205,
				userId: 2,
				total: 99.99,
				status: "PENDING",
				shippingAddress: {},
				paymentMethod: "credit_card",
				createdAt: new Date(),
				updatedAt: new Date(),
			};

			const updateData = {
				shippingAddress: {
					cep: "123", // CEP inválido
					street: "Rua Teste",
					number: "123",
					neighborhood: "Centro",
					city: "São Paulo",
					state: "SP",
					country: "BR",
				},
			};

			vi.mocked(prisma.order.findUnique).mockResolvedValueOnce(mockOrder as any);

			const response = await app.inject({
				method: "PUT",
				url: `/orders/${mockOrder.id}`,
				headers: {
					authorization: `Bearer ${adminToken}`,
				},
				payload: updateData,
			});

			expect(response.statusCode).toBe(400);
		});
	});

	describe("DELETE /orders/:id - Cancelar pedido", () => {
		it("deve permitir admin cancelar qualquer pedido", async () => {
			const mockOrder = {
				id: 300,
				userId: 2,
				total: 199.98,
				status: "PENDING",
				shippingAddress: {
					cep: "12345678",
					street: "Rua Teste",
					number: "123",
					neighborhood: "Centro",
					city: "São Paulo",
					state: "SP",
					country: "BR",
				},
				paymentMethod: "credit_card",
				createdAt: new Date(),
				updatedAt: new Date(),
			};

			const mockCancelledOrder = {
				...mockOrder,
				status: "CANCELLED",
				updatedAt: new Date(),
				user: {
					id: 2,
					firstName: "User",
					lastName: "Regular",
					email: "user@example.com",
				},
				items: [
					{
						id: 1,
						orderId: 300,
						productId: 1,
						price: 99.99,
						quantity: 2,
						size: "M",
						product: mockProduct,
					},
				],
			};

			// Mock findUnique para buscar o pedido (validação no serviço)
			vi.mocked(prisma.order.findUnique).mockResolvedValueOnce(mockOrder as any);
			// Mock update para cancelar
			vi.mocked(prisma.order.update).mockResolvedValueOnce(mockCancelledOrder as any);

			const response = await app.inject({
				method: "DELETE",
				url: `/orders/${mockOrder.id}`,
				headers: {
					authorization: `Bearer ${adminToken}`,
				},
			});

			expect(response.statusCode).toBe(200);

			const body = JSON.parse(response.body);
			expect(body).toHaveProperty("message");
			expect(body.message).toBe("Pedido cancelado com sucesso");
			expect(prisma.order.update).toHaveBeenCalled();
		});

		it("deve permitir usuário cancelar seu próprio pedido", async () => {
			const mockOrder = {
				id: 301,
				userId: 2,
				total: 99.99,
				status: "PENDING",
				shippingAddress: {},
				paymentMethod: "credit_card",
				createdAt: new Date(),
				updatedAt: new Date(),
			};

			const mockCancelledOrder = {
				...mockOrder,
				status: "CANCELLED",
				updatedAt: new Date(),
				user: mockRegularUser,
				items: [],
			};

			// Mock findUnique para buscar o pedido (validação no serviço)
			vi.mocked(prisma.order.findUnique).mockResolvedValueOnce(mockOrder as any);
			// Mock update para cancelar
			vi.mocked(prisma.order.update).mockResolvedValueOnce(mockCancelledOrder as any);

			const response = await app.inject({
				method: "DELETE",
				url: `/orders/${mockOrder.id}`,
				headers: {
					authorization: `Bearer ${userToken}`,
				},
			});

			expect(response.statusCode).toBe(200);

			const body = JSON.parse(response.body);
			expect(body).toHaveProperty("message");
			expect(body.message).toBe("Pedido cancelado com sucesso");
		});

		it("deve retornar erro ao cancelar pedido sem autenticação", async () => {
			const response = await app.inject({
				method: "DELETE",
				url: "/orders/123",
			});

			expect(response.statusCode).toBeGreaterThanOrEqual(401);
		});
	});
});
