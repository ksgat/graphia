import { json } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '$lib/server/db';
import { generateSubjectContent } from '$lib/server/generation';
import { subjects } from '$lib/server/db/schema';
import { isSameOrigin } from '$lib/server/security';
import type { RequestHandler } from './$types';

const regenerateRequestSchema = z.object({
	subjectId: z.uuid()
});

export const POST: RequestHandler = async ({ request, locals }) => {
	const session = await locals.auth();
	const userId = session?.user?.id;

	if (!userId) {
		return json({ error: 'unauthorized' }, { status: 401 });
	}

	if (!isSameOrigin(request)) {
		return json({ error: 'forbidden' }, { status: 403 });
	}

	const parsed = regenerateRequestSchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) {
		return json({ error: 'subjectId is required' }, { status: 400 });
	}

	const [subject] = await db
		.select()
		.from(subjects)
		.where(and(eq(subjects.id, parsed.data.subjectId), eq(subjects.userId, userId)))
		.limit(1);

	if (!subject) {
		return json({ error: 'subject not found' }, { status: 404 });
	}

	const result = await generateSubjectContent(subject.id, subject.subject);

	return json({ ok: result.status === 'done', subjectId: subject.id, status: result.status });
};
