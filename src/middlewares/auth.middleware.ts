import { FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../utils/prisma";

export const authenticate = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
	try {
		await request.jwtVerify();
		
		const userId = (request.user as any).userId;
		
		if (!userId) {
			return reply.status(401).send({ message: "Token inválido. ID do usuário não encontrado." });
		}
		
		const user = await prisma.user.findUnique({
			where: { id: userId },
			select: { role: true },
		});
		
		if (!user) {
			return reply.status(401).send({ message: "Usuário não encontrado." });
		}
		
		(request.user as any).role = user.role;
	} catch (err) {
		reply.status(401).send({ message: "Token inválido ou expirado" });
	}
};
