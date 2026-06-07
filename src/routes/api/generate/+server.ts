import { json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { generateGraph } from '$lib/ai/graph';
import { generateLesson } from '$lib/ai/lesson';
import { db } from '$lib/server/db';
import { graphs, lessons, subjects } from '$lib/server/db/schema';
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

	await generateAll(subjectRow.id, parsed.data.subject);

	return json({ subjectId: subjectRow.id });
};

async function generateAll(subjectId: string, subject: string) {
	try {
		const graphData = await generateGraph(subject);

		await db.insert(graphs).values({
			subjectId,
			nodes: graphData.nodes,
			edges: graphData.edges
		});

		for (const node of graphData.nodes) {
			const prerequisiteIds = graphData.edges
				.filter((edge) => edge.to === node.id)
				.map((edge) => edge.from);
			const prerequisiteLabels = graphData.nodes
				.filter((candidate) => prerequisiteIds.includes(candidate.id))
				.map((candidate) => candidate.label);

			const content = await generateLesson(subject, node.label, prerequisiteLabels, node.level);

			await db.insert(lessons).values({
				subjectId,
				nodeId: node.id,
				concept: node.label,
				content
			});
		}

		await db
			.update(subjects)
			.set({ status: 'done', error: null, updatedAt: new Date() })
			.where(eq(subjects.id, subjectId));
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Generation failed';

		await db
			.update(subjects)
			.set({ status: 'failed', error: message.slice(0, 500), updatedAt: new Date() })
			.where(eq(subjects.id, subjectId));
	}
}
