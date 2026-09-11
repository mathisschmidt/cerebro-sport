import { z } from 'zod';
import { idSchema } from './common.ts';

/**
 * Accounts and roles.
 *
 * Better Auth owns the storage and the password handling; this file owns the
 * shapes the app validates against, so a form, an endpoint and the admin screen
 * all agree on what a username is.
 */

/**
 * Sign-in is by username, but Better Auth requires an address, so one is
 * synthesised. Lives in the domain rather than the server layer because the
 * register form needs it too — and because a second copy of this rule would
 * silently create accounts nobody can sign into.
 */
export const SYNTHETIC_EMAIL_DOMAIN = 'cerebro-sport.local';

export function emailForUsername(name: string): string {
	return `${name.trim().toLowerCase()}@${SYNTHETIC_EMAIL_DOMAIN}`;
}

export const userRoleSchema = z.enum(['admin', 'user']);
export type UserRole = z.infer<typeof userRoleSchema>;

export const USER_ROLE_LABEL: Record<UserRole, string> = {
	admin: 'Admin',
	user: 'Athlete'
};

/**
 * What people sign in with. Kept deliberately narrow — it ends up in a
 * synthesised email address, so no spaces or exotic characters.
 *
 * The pieces are exported because the Better Auth username plugin is configured
 * from them: its own default is narrower (no dash, 30 characters), and a name
 * that passes here but not there could be saved and then refused at sign-in.
 */
export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 32;
export const USERNAME_PATTERN = /^[a-zA-Z0-9._-]+$/;

export const usernameSchema = z
	.string()
	.trim()
	.min(USERNAME_MIN_LENGTH, `At least ${USERNAME_MIN_LENGTH} characters`)
	.max(USERNAME_MAX_LENGTH, `At most ${USERNAME_MAX_LENGTH} characters`)
	.regex(USERNAME_PATTERN, 'Letters, numbers, dot, dash and underscore only');

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

/**
 * Someone changing their own password. This is Better Auth's `/change-password`
 * body exactly — the Account page calls that endpoint directly, since it is the
 * one account write the app adds no rule of its own to.
 */
export const changePasswordSchema = z
	.object({
		currentPassword: z.string().min(1, 'Required'),
		newPassword: passwordSchema,
		/** Ends every other session, so a device that was signed in with the old password is out. */
		revokeOtherSessions: z.boolean().default(false)
	})
	.refine((input) => input.newPassword !== input.currentPassword, {
		path: ['newPassword'],
		message: 'Choose a password you are not already using'
	});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

/** Someone renaming their own account. */
export const changeUsernameSchema = z.object({ username: usernameSchema });
export type ChangeUsernameInput = z.infer<typeof changeUsernameSchema>;

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
