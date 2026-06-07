import { env } from '$env/dynamic/private';
import { lessonPrompt } from './prompts';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL = 'meta-llama/llama-3.3-70b-instruct:free';

export async function generateLesson(
	subject: string,
	concept: string,
	prerequisites: string[],
	level: number
): Promise<string> {
	if (!env.OPENROUTER_API_KEY) {
		throw new Error('OPENROUTER_API_KEY is not set');
	}

	const response = await fetch(OPENROUTER_URL, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			model: env.OPENROUTER_MODEL || DEFAULT_MODEL,
			messages: [{ role: 'user', content: lessonPrompt(subject, concept, prerequisites, level) }]
		})
	});

	if (!response.ok) {
		throw new Error(`OpenRouter lesson request failed: ${response.status}`);
	}

	const data = await response.json();
	const content = data?.choices?.[0]?.message?.content;

	if (typeof content !== 'string' || content.trim().length === 0) {
		throw new Error('OpenRouter lesson response did not include message content');
	}

	return content.trim();
}
