import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../src/app";
import { prisma } from "../src/utils/prisma";
import { FastifyInstance } from "fastify";

describe("Auth Routes - Login", () => {
	const testEmail = `login-test-${Date.now()}@example.com`;
	const testPassword = "senha123";
	let app: FastifyInstance;

	beforeAll(async () => {
		app = await buildApp();

		// Cria um usuário para testar o login
		await app.inject({
			method: "POST",
			url: "/auth/register",
			payload: {
				firstName: "Teste",
				lastName: "Login",
				email: testEmail,
				password: testPassword,
			},
		});
	}, 10000);

	afterAll(async () => {
		// Limpa o usuário criado
		await prisma.user.deleteMany({
			where: {
				email: testEmail,
			},
		});
		await app.close();
	});

	it("deve fazer login com credenciais válidas", async () => {
		const loginData = {
			email: testEmail,
			password: testPassword,
		};

		const response = await app.inject({
			method: "POST",
			url: "/auth/login",
			payload: loginData,
		});

		// Verifica se o status é 200 (OK)
		expect(response.statusCode).toBe(200);

		const body = JSON.parse(response.body);

		// Verifica se retornou token
		expect(body).toHaveProperty("token");
		expect(typeof body.token).toBe("string");
		expect(body.token.length).toBeGreaterThan(0);

		// Verifica se retornou os dados do usuário
		expect(body).toHaveProperty("user");
		expect(body.user.email).toBe(testEmail);
		expect(body.user.firstName).toBe("Teste");

		// Verifica se NÃO retornou a senha
		expect(body.user).not.toHaveProperty("password");
	});

	it("deve retornar erro ao fazer login com senha incorreta", async () => {
		const loginData = {
			email: testEmail,
			password: "senhaErrada123",
		};

		const response = await app.inject({
			method: "POST",
			url: "/auth/login",
			payload: loginData,
		});

		// Deve retornar erro (401 Unauthorized)
		expect(response.statusCode).toBeGreaterThanOrEqual(400);
	});

	it("deve retornar erro ao fazer login com email inexistente", async () => {
		const loginData = {
			email: "naoexiste@example.com",
			password: testPassword,
		};

		const response = await app.inject({
			method: "POST",
			url: "/auth/login",
			payload: loginData,
		});

		// Deve retornar erro (401 ou 404)
		expect(response.statusCode).toBeGreaterThanOrEqual(400);
	});

	it("deve retornar erro ao fazer login sem campos obrigatórios", async () => {
		const loginData = {
			email: testEmail,
			// Faltando password
		};

		const response = await app.inject({
			method: "POST",
			url: "/auth/login",
			payload: loginData,
		});

		// Deve retornar erro de validação (400)
		expect(response.statusCode).toBe(400);
	});
});
