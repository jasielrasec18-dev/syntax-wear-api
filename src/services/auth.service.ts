import { RegisterRequest } from "../types";
import { prisma } from "../utils/prisma";

export const registerUser = async (payload: RegisterRequest) => {

	const existingUser = await prisma.user.findUnique({
		where: { email: payload.email },
	});

	if (existingUser) {
		throw new Error("Email já cadastrado.");
	}

	const newUser = await prisma.user.create({
		data: {
			firstName: payload.firstName,
			lastName: payload.lastName,
			email: payload.email,
			passwordHash: payload.password,
			cpf: payload.cpf,
			birthDate: payload.dateOfBirth || undefined,
			phone: payload.phone,
			role: "USER",
		},
	});

    return newUser;
};
