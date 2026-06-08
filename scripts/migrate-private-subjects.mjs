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

await sql`alter table subjects add column if not exists is_private boolean default false`;
await sql`update subjects set is_private = false where is_private is null`;
await sql`alter table subjects alter column is_private set not null`;

console.log('subjects table migrated with is_private flag');
