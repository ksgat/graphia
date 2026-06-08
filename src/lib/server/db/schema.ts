import { randomUUID } from 'node:crypto';
import type { AdapterAccountType } from '@auth/core/adapters';
import {
	boolean,
	integer,
	jsonb,
	pgTable,
	primaryKey,
	text,
	timestamp,
	uniqueIndex,
	uuid
} from 'drizzle-orm/pg-core';
import type { GraphEdge, GraphNode } from '../../types';

export const users = pgTable('users', {
	id: text('id').primaryKey().$defaultFn(randomUUID),
	name: text('name'),
	email: text('email').unique(),
	emailVerified: timestamp('email_verified', { mode: 'date' }),
	image: text('image')
});

export const accounts = pgTable(
	'accounts',
	{
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		type: text('type').$type<AdapterAccountType>().notNull(),
		provider: text('provider').notNull(),
		providerAccountId: text('provider_account_id').notNull(),
		refresh_token: text('refresh_token'),
		access_token: text('access_token'),
		expires_at: integer('expires_at'),
		token_type: text('token_type'),
		scope: text('scope'),
		id_token: text('id_token'),
		session_state: text('session_state')
	},
	(account) => [
		primaryKey({
			columns: [account.provider, account.providerAccountId]
		})
	]
);

export const sessions = pgTable('sessions', {
	sessionToken: text('session_token').primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	expires: timestamp('expires', { mode: 'date' }).notNull()
});

export const verificationTokens = pgTable(
	'verification_tokens',
	{
		identifier: text('identifier').notNull(),
		token: text('token').notNull(),
		expires: timestamp('expires', { mode: 'date' }).notNull()
	},
	(vt) => [
		primaryKey({
			columns: [vt.identifier, vt.token]
		})
	]
);

export const subjects = pgTable('subjects', {
	id: uuid('id').primaryKey().defaultRandom(),
	userId: text('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	subject: text('subject').notNull(),
	isPrivate: boolean('is_private').notNull().default(false),
	status: text('status').notNull().default('generating'),
	error: text('error'),
	createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
	updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull()
});

export const graphs = pgTable(
	'graphs',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		subjectId: uuid('subject_id')
			.notNull()
			.references(() => subjects.id, { onDelete: 'cascade' }),
		nodes: jsonb('nodes').$type<GraphNode[]>().notNull(),
		edges: jsonb('edges').$type<GraphEdge[]>().notNull(),
		createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull()
	},
	(table) => [uniqueIndex('graphs_subject_id_unique').on(table.subjectId)]
);

export const lessons = pgTable(
	'lessons',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		subjectId: uuid('subject_id')
			.notNull()
			.references(() => subjects.id, { onDelete: 'cascade' }),
		nodeId: text('node_id').notNull(),
		concept: text('concept').notNull(),
		content: text('content').notNull(),
		createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull()
	},
	(table) => [uniqueIndex('lessons_subject_node_unique').on(table.subjectId, table.nodeId)]
);

export const progress = pgTable(
	'progress',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		subjectId: uuid('subject_id')
			.notNull()
			.references(() => subjects.id, { onDelete: 'cascade' }),
		nodeId: text('node_id').notNull(),
		completed: boolean('completed').notNull().default(false),
		score: integer('score'),
		lastAccessedAt: timestamp('last_accessed_at', { mode: 'date' }).defaultNow().notNull(),
		completedAt: timestamp('completed_at', { mode: 'date' })
	},
	(table) => [uniqueIndex('progress_user_subject_node_unique').on(table.userId, table.subjectId, table.nodeId)]
);
