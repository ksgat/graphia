import { error, redirect } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { graphs, lessons, progress, subjects } from '$lib/server/db/schema';
import { getOrCreateLesson } from '$lib/server/lessons';
import { hasReachedDailyLessonStartLimit } from '$lib/server/security';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	const session = await locals.auth();
	const userId = session?.user?.id;

	const [subject] = await db
		.select()
		.from(subjects)
		.where(eq(subjects.id, params.subjectId))
		.limit(1);

	if (!subject) {
		error(404, 'Subject not found');
	}

	if (subject.isPrivate && subject.userId !== userId) {
		error(404, 'Subject not found');
	}

	const [graphRow] = await db
		.select()
		.from(graphs)
		.where(eq(graphs.subjectId, subject.id))
		.limit(1);

	if (!graphRow) {
		error(404, 'Graph not found');
	}

	const graph = {
		nodes: graphRow.nodes,
		edges: graphRow.edges
	};
	const node = graph.nodes.find((candidate) => candidate.id === params.nodeId);

	if (!node) {
		error(404, 'Node not found');
	}

	const subjectLessons = await db
		.select({
			id: lessons.id,
			nodeId: lessons.nodeId,
			concept: lessons.concept
		})
		.from(lessons)
		.where(eq(lessons.subjectId, subject.id));

	const prerequisiteIds = graph.edges.filter((edge) => edge.to === node.id).map((edge) => edge.from);
	const prerequisiteNodes = graph.nodes.filter((candidate) => prerequisiteIds.includes(candidate.id));
	const prerequisiteLessons = prerequisiteNodes.map((prerequisite) => {
		const lesson = subjectLessons.find((candidate) => candidate.nodeId === prerequisite.id);
		return {
			id: lesson?.id ?? '',
			nodeId: prerequisite.id,
			concept: lesson?.concept ?? prerequisite.label
		};
	});

	let completedNodeIds = new Set<string>();
	let currentProgress: { completed: boolean } | undefined;

	if (userId) {
		const rows = await db
			.select({
				nodeId: progress.nodeId,
				completed: progress.completed
			})
			.from(progress)
			.where(and(eq(progress.userId, userId), eq(progress.subjectId, subject.id)));

		completedNodeIds = new Set(rows.filter((row) => row.completed).map((row) => row.nodeId));
		currentProgress = rows.find((row) => row.nodeId === node.id);
	}

	const locked = prerequisiteIds.some((id) => !completedNodeIds.has(id));

	if (!userId) {
		redirect(303, '/');
	}

	if (locked) {
		return {
			session,
			subject: {
				id: subject.id,
				subject: subject.subject,
				status: subject.status
			},
			lesson: {
				id: '',
				subjectId: subject.id,
				nodeId: node.id,
				concept: node.label,
				content: '',
				createdAt: new Date().toISOString()
			},
			prerequisites: prerequisiteNodes.map((prerequisite) => ({
				id: prerequisite.id,
				nodeId: prerequisite.id,
				concept: prerequisite.label
			})),
			locked,
			completed: false
		};
	}

	const cachedLesson = subjectLessons.find((candidate) => candidate.nodeId === node.id);

	if (!cachedLesson && (await hasReachedDailyLessonStartLimit(userId))) {
		error(429, 'Daily lesson generation limit reached');
	}

	const lesson = await getOrCreateLesson(subject.id, subject.subject, graph, node.id);

	if (userId) {
		await db
			.insert(progress)
			.values({
				userId,
				subjectId: subject.id,
				nodeId: node.id,
				completed: false,
				lastAccessedAt: new Date()
			})
			.onConflictDoUpdate({
				target: [progress.userId, progress.subjectId, progress.nodeId],
				set: {
					lastAccessedAt: new Date()
				}
			});
	}

	return {
		session,
		subject: {
			id: subject.id,
			subject: subject.subject,
			status: subject.status
		},
		lesson: {
			...lesson,
			createdAt: lesson.createdAt.toISOString()
		},
		prerequisites: prerequisiteLessons,
		locked,
		completed: currentProgress?.completed ?? false
	};
};
