import { error } from '@sveltejs/kit';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { graphs, lessons, progress, subjects } from '$lib/server/db/schema';
import { getOrCreateLesson } from '$lib/server/lessons';
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
	const prerequisiteLessons = subjectLessons.filter((candidate) =>
		prerequisiteIds.includes(candidate.nodeId)
	);

	let completedLessonIds = new Set<string>();

	if (userId && subjectLessons.length > 0) {
		const rows = await db
			.select({
				lessonId: progress.lessonId
			})
			.from(progress)
			.where(
				and(
					eq(progress.userId, userId),
					inArray(
						progress.lessonId,
						subjectLessons.map((candidate) => candidate.id)
					)
				)
			);

		completedLessonIds = new Set(rows.map((row) => row.lessonId));
	}

	const locked = prerequisiteIds.some((id) => {
		const lesson = subjectLessons.find((candidate) => candidate.nodeId === id);
		return !lesson || !completedLessonIds.has(lesson.id);
	});

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

	const lesson = await getOrCreateLesson(subject.id, subject.subject, graph, node.id);

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
		completed: completedLessonIds.has(lesson.id)
	};
};
