import { error, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { lessons } from '$lib/server/db/schema';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const [lesson] = await db
		.select({
			subjectId: lessons.subjectId,
			nodeId: lessons.nodeId
		})
		.from(lessons)
		.where(eq(lessons.id, params.lessonId))
		.limit(1);

	if (!lesson) {
		error(404, 'Lesson not found');
	}

	redirect(303, `/lesson/${lesson.subjectId}/${lesson.nodeId}`);
};
