import type { ChangeUsernameInput, SessionUser } from '$domain/models/user.ts';
import { renameUser } from '../auth/users.ts';
import { conflict } from '../http/errors.ts';

/**
 * The signed-in person editing their own account.
 *
 * Passwords are not here: they are Better Auth's business end to end, and the
 * Account page talks to it directly. The username is the app's business, since
 * the synthesised email has to follow it — see `renameUser`.
 */
export const accountService = {
	changeUsername(user: SessionUser, input: ChangeUsernameInput): SessionUser {
		// Stored lowercase, like everything that creates an account.
		const name = input.username.trim().toLowerCase();
		if (name === user.username) return user;

		if (!renameUser(user.id, name)) {
			throw conflict(`"${name}" is already taken`, { username: 'Already taken' });
		}
		return { ...user, username: name, name };
	}
};
