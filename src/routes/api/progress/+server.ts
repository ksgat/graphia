import { json } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '$lib/server/db';
import { graphs, lessons, progress } from '$lib/server/db/schema';
import { isSameOrigin } from '$lib/server/security';
import type { RequestHandler } from './$types';

const progressRequestSchema = z.object({
	subjectId: z.uuid(),
	nodeId: z.string().min(1),
	score: z.number().int().min(0).max(100)
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

	const parsed = progressRequestSchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) {
		return json({ error: 'invalid progress payload' }, { status: 400 });
	}

	const [graph] = await db
		.select({
			nodes: graphs.nodes,
			edges: graphs.edges
		})
		.from(graphs)
		.where(eq(graphs.subjectId, parsed.data.subjectId))
		.limit(1);

	if (!graph) {
		return json({ error: 'graph not found' }, { status: 404 });
	}

	const node = graph.nodes.find((candidate) => candidate.id === parsed.data.nodeId);
	if (!node) {
		return json({ error: 'node not found' }, { status: 404 });
	}

	const [lesson] = await db
		.select({ id: lessons.id })
		.from(lessons)
		.where(and(eq(lessons.subjectId, parsed.data.subjectId), eq(lessons.nodeId, parsed.data.nodeId)))
		.limit(1);

	if (!lesson) {
		return json({ error: 'lesson has not been generated' }, { status: 409 });
	}

	const existingProgress = await db
		.select({
			nodeId: progress.nodeId,
			completed: progress.completed
		})
		.from(progress)
		.where(and(eq(progress.userId, userId), eq(progress.subjectId, parsed.data.subjectId)));

	const completedNodeIds = new Set(
		existingProgress.filter((row) => row.completed).map((row) => row.nodeId)
	);
	const prerequisiteIds = graph.edges
		.filter((edge) => edge.to === parsed.data.nodeId)
		.map((edge) => edge.from);

	if (prerequisiteIds.some((id) => !completedNodeIds.has(id))) {
		return json({ error: 'complete prerequisites before saving this lesson' }, { status: 403 });
	}

	await db
		.insert(progress)
		.values({
			userId,
			subjectId: parsed.data.subjectId,
			nodeId: parsed.data.nodeId,
			completed: true,
			score: parsed.data.score,
			lastAccessedAt: new Date(),
			completedAt: new Date()
		})
		.onConflictDoUpdate({
			target: [progress.userId, progress.subjectId, progress.nodeId],
			set: {
				completed: true,
				score: parsed.data.score,
				lastAccessedAt: new Date(),
				completedAt: new Date()
			}
		});

	return json({ ok: true });
};
