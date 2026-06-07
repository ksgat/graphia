import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { db } from '$lib/server/db';
import { generateSubjectContent } from '$lib/server/generation';
import { subjects } from '$lib/server/db/schema';
import type { RequestHandler } from './$types';

const generateRequestSchema = z.object({
	subject: z.string().trim().min(2).max(120)
});

export const POST: RequestHandler = async ({ request, locals }) => {
	const session = await locals.auth();
	const userId = session?.user?.id;

	if (!userId) {
		return json({ error: 'unauthorized' }, { status: 401 });
	}

	const parsed = generateRequestSchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) {
		return json({ error: 'subject is required' }, { status: 400 });
	}

	const [subjectRow] = await db
		.insert(subjects)
		.values({
			userId,
			subject: parsed.data.subject,
			status: 'generating'
		})
		.returning();

	const result = await generateSubjectContent(subjectRow.id, parsed.data.subject);

	return json({ subjectId: subjectRow.id, status: result.status });
};
