import { and, desc, eq } from 'drizzle-orm';
import { redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { graphs, progress, subjects, users } from '$lib/server/db/schema';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const session = await locals.auth();

	if (!session?.user) {
		redirect(303, '/');
	}

	const subjectRows = await db
		.select({
			id: subjects.id,
			subject: subjects.subject,
			status: subjects.status,
			error: subjects.error,
			createdAt: subjects.createdAt,
			authorName: users.name,
			authorImage: users.image,
			nodes: graphs.nodes
		})
		.from(subjects)
		.leftJoin(users, eq(subjects.userId, users.id))
		.leftJoin(graphs, eq(subjects.id, graphs.subjectId))
		.orderBy(desc(subjects.createdAt))
		.limit(30);

	const activityRows = await db
		.select({
			subjectId: progress.subjectId,
			nodeId: progress.nodeId,
			completed: progress.completed,
			score: progress.score,
			lastAccessedAt: progress.lastAccessedAt,
			subject: subjects.subject,
			nodes: graphs.nodes,
			edges: graphs.edges
		})
		.from(progress)
		.innerJoin(subjects, eq(progress.subjectId, subjects.id))
		.innerJoin(graphs, eq(progress.subjectId, graphs.subjectId))
		.where(eq(progress.userId, session.user.id))
		.orderBy(desc(progress.lastAccessedAt))
		.limit(8);

	const activeRow = activityRows.find((row) => !row.completed) ?? activityRows[0];
	let jumpBack = null;

	if (activeRow) {
		const node = activeRow.nodes.find((candidate) => candidate.id === activeRow.nodeId);
		const subjectProgressRows = await db
			.select({
				nodeId: progress.nodeId,
				completed: progress.completed
			})
			.from(progress)
			.where(and(eq(progress.userId, session.user.id), eq(progress.subjectId, activeRow.subjectId)));
		const completedNodeIds = new Set(
			subjectProgressRows.filter((row) => row.completed).map((row) => row.nodeId)
		);
		const nextNode = activeRow.nodes
			.filter((candidate) => !completedNodeIds.has(candidate.id))
			.filter((candidate) =>
				activeRow.edges
					.filter((edge) => edge.to === candidate.id)
					.every((edge) => completedNodeIds.has(edge.from))
			)
			.sort((a, b) => a.level - b.level || a.label.localeCompare(b.label))[0];

		jumpBack = {
			subjectId: activeRow.subjectId,
			subject: activeRow.subject,
			nodeId: activeRow.nodeId,
			nodeLabel: node?.label ?? activeRow.nodeId,
			nodeSummary: node?.summary ?? '',
			completed: activeRow.completed,
			score: activeRow.score,
			lastAccessedAt: activeRow.lastAccessedAt.toISOString(),
			nextNode: nextNode
				? {
						id: nextNode.id,
						label: nextNode.label,
						summary: nextNode.summary
					}
				: null
		};
	}

	return {
		session,
		jumpBack,
		subjects: subjectRows.map((row) => ({
			...row,
			createdAt: row.createdAt.toISOString(),
			nodeCount: row.nodes?.length ?? 0
		}))
	};
};
