import { and, eq } from 'drizzle-orm';
import { generateLesson } from '$lib/ai/lesson';
import { parseExercises } from '$lib/parseExercises';
import type { GraphData, GraphNode } from '$lib/types';
import { db } from '$lib/server/db';
import { lessons } from '$lib/server/db/schema';

export async function getOrCreateLesson(subjectId: string, subject: string, graph: GraphData, nodeId: string) {
	const [existing] = await db
		.select()
		.from(lessons)
		.where(and(eq(lessons.subjectId, subjectId), eq(lessons.nodeId, nodeId)))
		.limit(1);

	if (existing) return existing;

	const node = graph.nodes.find((candidate) => candidate.id === nodeId);
	if (!node) {
		throw new Error('Graph node not found');
	}

	const prerequisiteLabels = getPrerequisiteLabels(graph, node);
	console.info('generation.lesson.start', { subjectId, nodeId: node.id });
	const content = await generateLesson(subject, node.label, prerequisiteLabels, node.level);
	const exerciseCount = parseExercises(content).length;

	if (exerciseCount < 5) {
		throw new Error(`Lesson "${node.label}" only generated ${exerciseCount} questions`);
	}

	const [created] = await db
		.insert(lessons)
		.values({
			subjectId,
			nodeId: node.id,
			concept: node.label,
			content
		})
		.onConflictDoUpdate({
			target: [lessons.subjectId, lessons.nodeId],
			set: {
				concept: node.label,
				content
			}
		})
		.returning();

	console.info('generation.lesson.done', {
		subjectId,
		nodeId: node.id,
		exerciseCount
	});

	return created;
}

function getPrerequisiteLabels(graph: GraphData, node: GraphNode) {
	const prerequisiteIds = graph.edges.filter((edge) => edge.to === node.id).map((edge) => edge.from);

	return graph.nodes
		.filter((candidate) => prerequisiteIds.includes(candidate.id))
		.map((candidate) => candidate.label);
}
