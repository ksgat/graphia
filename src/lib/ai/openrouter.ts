import { env } from '$env/dynamic/private';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const RETRIES = 2;
const TIMEOUT_MS = 45_000;

interface ChatMessage {
	role: 'system' | 'user' | 'assistant';
	content: string;
}

export async function requestOpenRouter(messages: ChatMessage[], responseFormat?: { type: 'json_object' }) {
	if (!env.OPENROUTER_API_KEY) {
		throw new Error('OPENROUTER_API_KEY is not set');
	}
	if (!env.OPENROUTER_MODEL) {
		throw new Error('OPENROUTER_MODEL is not set');
	}

	let lastError: unknown;

	for (let attempt = 0; attempt <= RETRIES; attempt += 1) {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

		try {
			const response = await fetch(OPENROUTER_URL, {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					model: env.OPENROUTER_MODEL,
					messages,
					response_format: responseFormat
				}),
				signal: controller.signal
			});

			const body = await response.json().catch(() => null);

			if (!response.ok) {
				const message =
					typeof body?.error?.message === 'string'
						? body.error.message
						: `OpenRouter request failed: ${response.status}`;
				throw new Error(message);
			}

			const content = body?.choices?.[0]?.message?.content;
			if (typeof content !== 'string' || content.trim().length === 0) {
				throw new Error('OpenRouter response did not include message content');
			}

			return content.trim();
		} catch (error) {
			lastError = error;
			if (attempt < RETRIES) await sleep(750 * (attempt + 1));
		} finally {
			clearTimeout(timeout);
		}
	}

	throw lastError instanceof Error ? lastError : new Error('OpenRouter request failed');
}

function sleep(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
