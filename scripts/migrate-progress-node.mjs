import { readFileSync } from 'node:fs';
import { neon } from '@neondatabase/serverless';

for (const line of readFileSync('.env', 'utf8').split(/\r?\n/)) {
	const match = line.match(/^\s*([^#=]+)=(.*)\s*$/);
	if (!match) continue;

	const key = match[1].trim();
	const value = match[2].trim().replace(/^"(.*)"$/, '$1');
	process.env[key] ??= value;
}

if (!process.env.DATABASE_URL) {
	throw new Error('DATABASE_URL is not set');
}

const sql = neon(process.env.DATABASE_URL);

await sql`alter table progress add column if not exists subject_id uuid`;
await sql`alter table progress add column if not exists node_id text`;
await sql`alter table progress add column if not exists last_accessed_at timestamp default now()`;

await sql`
	update progress
	set
		subject_id = lessons.subject_id,
		node_id = lessons.node_id,
		last_accessed_at = coalesce(progress.completed_at, progress.last_accessed_at, now())
	from lessons
	where progress.lesson_id = lessons.id
		and (progress.subject_id is null or progress.node_id is null)
`;

await sql`delete from progress where subject_id is null or node_id is null`;
await sql`alter table progress alter column subject_id set not null`;
await sql`alter table progress alter column node_id set not null`;
await sql`alter table progress alter column last_accessed_at set not null`;

await sql`alter table progress drop constraint if exists progress_lesson_id_lessons_id_fk`;
await sql`drop index if exists progress_user_lesson_unique`;
await sql`
	alter table progress
	add constraint progress_subject_id_subjects_id_fk
	foreign key (subject_id) references subjects(id) on delete cascade
`;
await sql`alter table progress drop column if exists lesson_id`;
await sql`
	create unique index if not exists progress_user_subject_node_unique
	on progress(user_id, subject_id, node_id)
`;

console.log('progress table migrated to user + subject + node tracking');
