import "dotenv/config";
import { beforeAll, afterAll } from "vitest";
import { prisma } from "../src/utils/prisma";

// Executado antes de todos os testes
beforeAll(async () => {
	// Aqui podemos configurar o banco de dados de teste
	console.log("🧪 Iniciando testes...");
});

// Executado depois de todos os testes
afterAll(async () => {
	// Limpar conexão com banco
	await prisma.$disconnect();
	console.log("✅ Testes finalizados");
});