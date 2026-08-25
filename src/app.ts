import Fastify from "fastify";
import "dotenv/config";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import productRoutes from "./routes/products.routes";
import swagger from "@fastify/swagger";
import scalar from "@scalar/fastify-api-reference";

const PORT = parseInt(process.env.PORT ?? "3000");

const fastify = Fastify({
	logger: true,
});

fastify.register(cors, {
	origin: true,
	credentials: true,
});

fastify.register(helmet, {
	contentSecurityPolicy: false,
});

fastify.register(swagger, {
	openapi: {
		openapi: "3.0.0",
		info: {
			title: "Syntax Wear API",
			description: "API para o e-commerce Syntax Wear",
			version: "1.0.0",
		},
		servers: [
			{
				url: `http://localhost:${PORT}`,
				description: "Servidor de desenvolvimento",
			},
		],
		components: {
			securitySchemes: {
				bearerAuth: {
					type: "http",
					scheme: "bearer",
					bearerFormat: "JWT",
					description: "Autenticação via token JWT",
				},
			},
		},
	},
});

fastify.register(scalar, {
	routePrefix: "/api-docs",
	configuration: {
		theme: "default",
	},
});

fastify.register(productRoutes, { prefix: "/products" });

fastify.get("/", async (request, reply) => {
	return {
		message: "E-commerce Syntax Wear API",
		version: "1.0.0",
		status: "running",
	};
});

fastify.get("/health", async (request, reply) => {
	return {
		status: "ok",
		timestamp: new Date().toISOString(),
	};
});

fastify.listen({ port: PORT }, function (err, address) {
	if (err) {
		fastify.log.error(err);
		process.exit(1);
	}
});

export default fastify;
