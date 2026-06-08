import { error, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { lessons, subjects } from '$lib/server/db/schema';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	const session = await locals.auth();
	const userId = session?.user?.id;

	const [lesson] = await db
		.select({
			subjectId: lessons.subjectId,
			nodeId: lessons.nodeId,
			subjectUserId: subjects.userId,
			subjectIsPrivate: subjects.isPrivate
		})
		.from(lessons)
		.innerJoin(subjects, eq(lessons.subjectId, subjects.id))
		.where(eq(lessons.id, params.lessonId))
		.limit(1);

	if (!lesson) {
		error(404, 'Lesson not found');
	}

	if (lesson.subjectIsPrivate && lesson.subjectUserId !== userId) {
		error(404, 'Lesson not found');
	}

	redirect(303, `/lesson/${lesson.subjectId}/${lesson.nodeId}`);
};
