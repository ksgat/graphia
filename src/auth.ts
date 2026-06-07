import { DrizzleAdapter } from '@auth/drizzle-adapter';
import { SvelteKitAuth } from '@auth/sveltekit';
import GitHub from '@auth/sveltekit/providers/github';
import { db } from '$lib/server/db';
import { accounts, sessions, users, verificationTokens } from '$lib/server/db/schema';

export const { handle, signIn, signOut } = SvelteKitAuth({
	adapter: DrizzleAdapter(db, {
		usersTable: users,
		accountsTable: accounts,
		sessionsTable: sessions,
		verificationTokensTable: verificationTokens
	}),
	providers: [GitHub],
	trustHost: true,
	session: { strategy: 'database' },
	callbacks: {
		session({ session, user }) {
			if (session.user) {
				session.user.id = user.id;
			}

			return session;
		}
	}
});
