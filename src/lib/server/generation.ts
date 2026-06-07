import { eq } from 'drizzle-orm';
import { generateGraph } from '$lib/ai/graph';
import { db } from '$lib/server/db';
import { graphs, lessons, progress, subjects } from '$lib/server/db/schema';

export async function generateSubjectContent(subjectId: string, subject: string) {
	try {
		await db
			.update(subjects)
			.set({ status: 'generating', error: null, updatedAt: new Date() })
			.where(eq(subjects.id, subjectId));

		const graphData = await generateGraph(subject);
		const existingLessons = await db
			.select({ id: lessons.id })
			.from(lessons)
			.where(eq(lessons.subjectId, subjectId));

		for (const lesson of existingLessons) {
			await db.delete(progress).where(eq(progress.lessonId, lesson.id));
		}
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

		await db
			.update(subjects)
			.set({ status: 'failed', error: message.slice(0, 500), updatedAt: new Date() })
			.where(eq(subjects.id, subjectId));

		return { status: 'failed' as const, error: message };
	}
}
