import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../src/app";
import { prisma } from "../src/utils/prisma";
import { FastifyInstance } from "fastify";

describe("Auth Routes - Register", () => {
	// Variável para armazenar email único em cada teste
	const testEmail = `test-${Date.now()}@example.com`;
    //cpf randomizado
    const testCpf = `cpf-${Date.now()}`;
	let app: FastifyInstance;

	beforeAll(async () => {
		// Cria uma nova instância do app para testes
		app = await buildApp();
	}, 10000);

	afterAll(async () => {
		// Limpa o usuário criado durante o teste
		await prisma.user.deleteMany({
			where: {
				email: {
					contains: "test-",
				},
			},
		});
		await app.close();
	});

	it("deve criar um novo usuário com sucesso", async () => {
		// Dados do usuário para registro
		const userData = {
			firstName: "João",
			lastName: "Silva",
			email: testEmail,
			password: "senha123",
            cpf: testCpf,
		};

		// Faz a requisição POST para /auth/register
		const response = await app.inject({
			method: "POST",
			url: "/auth/register",
			payload: userData,
		});

		// Verifica se o status é 201 (Created)
		expect(response.statusCode).toBe(201);

		// Parseia o JSON da resposta
		const body = JSON.parse(response.body);

		// Verifica se retornou token
		expect(body).toHaveProperty("token");
		expect(typeof body.token).toBe("string");
		expect(body.token.length).toBeGreaterThan(0);

		// Verifica se retornou os dados do usuário
		expect(body).toHaveProperty("user");
		expect(body.user).toHaveProperty("id");
		expect(body.user.email).toBe(testEmail);
		expect(body.user.firstName).toBe("João");
		expect(body.user.lastName).toBe("Silva");

		// Verifica se NÃO retornou a senha (segurança)
		expect(body.user).not.toHaveProperty("password");
	});

	it("deve retornar erro ao tentar registrar com email duplicado", async () => {
		const userData = {
			firstName: "Maria",
			lastName: "Santos",
			email: testEmail, // Mesmo email do teste anterior
			password: "senha456",
		};

		const response = await app.inject({
			method: "POST",
			url: "/auth/register",
			payload: userData,
		});

		// Deve retornar erro (400 ou 409)
		expect(response.statusCode).toBeGreaterThanOrEqual(400);
	});

	it("deve retornar erro ao tentar registrar sem campos obrigatórios", async () => {
		const userData = {
			firstName: "Pedro",
			// Faltando lastName, email e password
		};

		const response = await app.inject({
			method: "POST",
			url: "/auth/register",
			payload: userData,
		});

		// Deve retornar erro de validação (400)
		expect(response.statusCode).toBe(400);
	});
});

