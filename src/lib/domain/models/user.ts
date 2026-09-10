import { z } from 'zod';
import { idSchema } from './common.ts';

/**
 * Accounts and roles.
 *
 * Better Auth owns the storage and the password handling; this file owns the
 * shapes the app validates against, so a form, an endpoint and the admin screen
 * all agree on what a username is.
 */

export const userRoleSchema = z.enum(['admin', 'user']);
export type UserRole = z.infer<typeof userRoleSchema>;

export const USER_ROLE_LABEL: Record<UserRole, string> = {
	admin: 'Admin',
	user: 'Athlete'
};

/**
 * What people sign in with. Kept deliberately narrow — it ends up in a
 * synthesised email address, so no spaces or exotic characters.
 */
export const usernameSchema = z
	.string()
	.trim()
	.min(3, 'At least 3 characters')
	.max(32, 'At most 32 characters')
	.regex(/^[a-zA-Z0-9._-]+$/, 'Letters, numbers, dot, dash and underscore only');

export const passwordSchema = z
	.string()
	.min(8, 'At least 8 characters')
	.max(128, 'At most 128 characters');

export const credentialsSchema = z.object({
	username: usernameSchema,
	password: passwordSchema
});
export type Credentials = z.infer<typeof credentialsSchema>;

/** Body for an admin adding someone. */
export const createUserSchema = credentialsSchema.extend({
	role: userRoleSchema.default('user')
});
export type CreateUserInput = z.infer<typeof createUserSchema>;

export const changePasswordSchema = z.object({
	currentPassword: z.string().min(1, 'Required'),
	newPassword: passwordSchema
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

/** The signed-in user, as every page and endpoint sees them. */
export interface SessionUser {
	id: string;
	username: string;
	name: string;
	role: UserRole;
}

/** A row in the admin's user list. */
export interface ManagedUser {
	id: string;
	username: string;
	name: string;
	role: UserRole;
	createdAt: string;
	/** Training data owned by this account, so a delete says what it removes. */
	sessionCount: number;
	workoutCount: number;
}

export const userIdSchema = z.object({ userId: idSchema });

export const setRoleSchema = z.object({
	userId: idSchema,
	role: userRoleSchema
});
export type SetRoleInput = z.infer<typeof setRoleSchema>;
