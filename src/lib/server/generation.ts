import { eq } from 'drizzle-orm';
import { generateGraph } from '$lib/ai/graph';
import { db } from '$lib/server/db';
import { graphs, lessons, progress, subjects } from '$lib/server/db/schema';

export async function generateSubjectContent(subjectId: string, subject: string) {
	try {
		console.info('generation.graph.start', { subjectId });

		await db
			.update(subjects)
			.set({ status: 'generating', error: null, updatedAt: new Date() })
			.where(eq(subjects.id, subjectId));

		const graphData = await generateGraph(subject);
		console.info('generation.graph.done', {
			subjectId,
			nodeCount: graphData.nodes.length,
			edgeCount: graphData.edges.length
		});

		await db.delete(progress).where(eq(progress.subjectId, subjectId));
		await db.delete(lessons).where(eq(lessons.subjectId, subjectId));

		await db
			.insert(graphs)
			.values({
				subjectId,
				nodes: graphData.nodes,
				edges: graphData.edges
			})
			.onConflictDoUpdate({
				target: graphs.subjectId,
				set: {
					nodes: graphData.nodes,
					edges: graphData.edges
				}
			});

		await db
			.update(subjects)
			.set({ status: 'done', error: null, updatedAt: new Date() })
			.where(eq(subjects.id, subjectId));

		return { status: 'done' as const };
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Generation failed';
		console.error('generation.graph.failed', { subjectId, message });

		await db
			.update(subjects)
			.set({ status: 'failed', error: message.slice(0, 500), updatedAt: new Date() })
			.where(eq(subjects.id, subjectId));

		return { status: 'failed' as const, error: message };
	}
}
