import { error } from '@sveltejs/kit';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { graphs, lessons, progress, subjects } from '$lib/server/db/schema';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	const session = await locals.auth();
	const userId = session?.user?.id;

	const [lesson] = await db.select().from(lessons).where(eq(lessons.id, params.lessonId)).limit(1);

	if (!lesson) {
		error(404, 'Lesson not found');
	}

	const [subject] = await db
		.select()
		.from(subjects)
		.where(eq(subjects.id, lesson.subjectId))
		.limit(1);

	if (!subject) {
		error(404, 'Subject not found');
	}

	const [graph] = await db
		.select()
		.from(graphs)
		.where(eq(graphs.subjectId, subject.id))
		.limit(1);

	const subjectLessons = await db
		.select({
			id: lessons.id,
			nodeId: lessons.nodeId,
			concept: lessons.concept
		})
		.from(lessons)
		.where(eq(lessons.subjectId, subject.id));

	const prerequisiteIds = graph?.edges
		.filter((edge) => edge.to === lesson.nodeId)
		.map((edge) => edge.from) ?? [];
	const prerequisiteLessons = subjectLessons.filter((candidate) =>
		prerequisiteIds.includes(candidate.nodeId)
	);

	let completedLessonIds = new Set<string>();

	if (userId && subjectLessons.length > 0) {
		const rows = await db
			.select({
				lessonId: progress.lessonId
			})
			.from(progress)
			.where(
				and(
					eq(progress.userId, userId),
					inArray(
						progress.lessonId,
						subjectLessons.map((candidate) => candidate.id)
					)
				)
			);

		completedLessonIds = new Set(rows.map((row) => row.lessonId));
	}

	const locked = prerequisiteLessons.some((prerequisite) => !completedLessonIds.has(prerequisite.id));

	return {
		session,
		subject: {
			id: subject.id,
			subject: subject.subject,
			status: subject.status
		},
		lesson: {
			...lesson,
			createdAt: lesson.createdAt.toISOString()
		},
		prerequisites: prerequisiteLessons,
		locked,
		completed: completedLessonIds.has(lesson.id)
	};
};
