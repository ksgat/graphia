import { error } from '@sveltejs/kit';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { graphs, lessons, progress, subjects } from '$lib/server/db/schema';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	const session = await locals.auth();
	const userId = session?.user?.id;

	const [subject] = await db
		.select()
		.from(subjects)
		.where(eq(subjects.id, params.subjectId))
		.limit(1);

	if (!subject) {
		error(404, 'Subject not found');
	}

	const [graph] = await db
		.select()
		.from(graphs)
		.where(eq(graphs.subjectId, subject.id))
		.limit(1);

	const lessonRows = await db
		.select({
			id: lessons.id,
			nodeId: lessons.nodeId,
			concept: lessons.concept
		})
		.from(lessons)
		.where(eq(lessons.subjectId, subject.id))
		.orderBy(asc(lessons.createdAt));

	let progressRows: { lessonId: string; completed: boolean; score: number | null }[] = [];

	if (userId && lessonRows.length > 0) {
		progressRows = await db
			.select({
				lessonId: progress.lessonId,
				completed: progress.completed,
				score: progress.score
			})
			.from(progress)
			.where(
				and(
					eq(progress.userId, userId),
					inArray(
						progress.lessonId,
						lessonRows.map((lesson) => lesson.id)
					)
				)
			);
	}

	return {
		session,
		subject: {
			...subject,
			createdAt: subject.createdAt.toISOString(),
			updatedAt: subject.updatedAt.toISOString()
		},
		graph: graph
			? {
					id: graph.id,
					nodes: graph.nodes,
					edges: graph.edges,
					createdAt: graph.createdAt.toISOString()
				}
			: null,
		lessons: lessonRows,
		progress: progressRows
	};
};
