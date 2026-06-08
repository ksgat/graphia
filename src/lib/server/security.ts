import { and, count, eq, gt } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { progress, subjects } from '$lib/server/db/schema';

const DAILY_GRAPH_GENERATION_LIMIT = 20;
const DAILY_LESSON_START_LIMIT = 100;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export function isSameOrigin(request: Request) {
	const origin = request.headers.get('origin');
	if (!origin) return true;

	return origin === new URL(request.url).origin;
}

export async function hasReachedDailyGraphGenerationLimit(userId: string) {
	const [row] = await db
		.select({ value: count() })
		.from(subjects)
		.where(and(eq(subjects.userId, userId), gt(subjects.createdAt, oneDayAgo())));

	return row.value >= DAILY_GRAPH_GENERATION_LIMIT;
}

export async function hasReachedDailyLessonStartLimit(userId: string) {
	const [row] = await db
		.select({ value: count() })
		.from(progress)
		.where(and(eq(progress.userId, userId), gt(progress.lastAccessedAt, oneDayAgo())));

	return row.value >= DAILY_LESSON_START_LIMIT;
}

function oneDayAgo() {
	return new Date(Date.now() - ONE_DAY_MS);
}
