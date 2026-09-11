import { changeUsernameSchema } from '$domain/models/user.ts';
import { accountService } from '$server/services/index.ts';
import { authed, readBody } from '$server/http/respond.ts';

export const PATCH = authed(async ({ request }, user) =>
	accountService.changeUsername(user, await readBody(request, changeUsernameSchema))
);
