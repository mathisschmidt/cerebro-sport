import { createUserSchema, setRoleSchema, userIdSchema } from '$domain/models/user.ts';
import { adminService } from '$server/services/index.ts';
import { adminOnly, readBody } from '$server/http/respond.ts';

export const GET = adminOnly(() => adminService.listUsers());

export const POST = adminOnly(
	async ({ request }) => {
		const input = await readBody(request, createUserSchema);
		// The admin's own cookies are forwarded so Better Auth authorises the call.
		return adminService.createUser(request.headers, input);
	},
	{ status: 201 }
);

export const PATCH = adminOnly(async ({ request }, user) => {
	const input = await readBody(request, setRoleSchema);
	await adminService.setRole(request.headers, user.id, input);
	return adminService.listUsers();
});

export const DELETE = adminOnly(async ({ request }, user) => {
	const { userId } = await readBody(request, userIdSchema);
	await adminService.removeUser(request.headers, user.id, userId);
	return null;
});
