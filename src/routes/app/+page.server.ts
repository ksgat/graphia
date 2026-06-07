import { desc, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { graphs, subjects, users } from '$lib/server/db/schema';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const session = await locals.auth();

	const subjectRows = await db
		.select({
			id: subjects.id,
			subject: subjects.subject,
			status: subjects.status,
			error: subjects.error,
			createdAt: subjects.createdAt,
			authorName: users.name,
			authorImage: users.image,
			nodes: graphs.nodes
		})
		.from(subjects)
		.leftJoin(users, eq(subjects.userId, users.id))
		.leftJoin(graphs, eq(subjects.id, graphs.subjectId))
		.orderBy(desc(subjects.createdAt))
		.limit(30);

	return {
		session,
		subjects: subjectRows.map((row) => ({
			...row,
			createdAt: row.createdAt.toISOString(),
			nodeCount: row.nodes?.length ?? 0
		}))
	};
};
