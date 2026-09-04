import { FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../utils/prisma";

export const requireAdmin = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
	try {
	
		await request.jwtVerify();

		const userId = (request.user as any).userId;

		if (!userId) {
			return reply.status(401).send({ message: "Token inválido. ID do usuário não encontrado." });
		}
		
		const user = await prisma.user.findUnique({
			where: { id: userId },
			select: { id: true, role: true },
		});
		
		if (!user) {
			return reply.status(401).send({ message: "Usuário não encontrado." });
		}
		
		if (user.role !== "ADMIN") {
			return reply.status(403).send({ message: "Acesso negado. Requer permissão de administrador." });
		}
		
	} catch (err) {
		return reply.status(401).send({ message: "Token inválido ou expirado." });
	}
};
