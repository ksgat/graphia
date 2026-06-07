import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { db } from '$lib/server/db';
import { progress } from '$lib/server/db/schema';
import type { RequestHandler } from './$types';

const progressRequestSchema = z.object({
	lessonId: z.uuid(),
	score: z.number().int().min(0).max(100)
});

export const POST: RequestHandler = async ({ request, locals }) => {
	const session = await locals.auth();
	const userId = session?.user?.id;

	if (!userId) {
		return json({ error: 'unauthorized' }, { status: 401 });
	}

	const parsed = progressRequestSchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) {
		return json({ error: 'invalid progress payload' }, { status: 400 });
	}

	await db
		.insert(progress)
		.values({
			userId,
			lessonId: parsed.data.lessonId,
			completed: true,
			score: parsed.data.score,
			completedAt: new Date()
		})
		.onConflictDoUpdate({
			target: [progress.userId, progress.lessonId],
			set: {
				completed: true,
				score: parsed.data.score,
				completedAt: new Date()
			}
		});

	return json({ ok: true });
};
