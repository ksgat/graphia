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
					'Content-Type': 'application/json',
					'HTTP-Referer': env.ORIGIN ?? 'https://www.trygraphia.app',
					'X-Title': 'Graphia'
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

			const content = extractMessageContent(body);
			if (!content) {
				throw new Error(`OpenRouter response did not include message content: ${summarizeBody(body)}`);
			}

			return content;
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

function extractMessageContent(body: unknown) {
	if (!body || typeof body !== 'object') return null;

	const candidate = body as {
		choices?: {
			message?: {
				content?: unknown;
				refusal?: unknown;
				reasoning?: unknown;
			};
			text?: unknown;
			finish_reason?: unknown;
		}[];
		output_text?: unknown;
	};
	const choice = candidate.choices?.[0];
	const content = choice?.message?.content;

	if (typeof content === 'string' && content.trim()) return content.trim();
	if (Array.isArray(content)) {
		const text = content
			.map((part) => {
				if (typeof part === 'string') return part;
				if (part && typeof part === 'object' && 'text' in part) {
					const text = (part as { text?: unknown }).text;
					return typeof text === 'string' ? text : '';
				}
				return '';
			})
			.join('')
			.trim();
		if (text) return text;
	}

	if (typeof choice?.text === 'string' && choice.text.trim()) return choice.text.trim();
	if (typeof candidate.output_text === 'string' && candidate.output_text.trim()) {
		return candidate.output_text.trim();
	}

	return null;
}

function summarizeBody(body: unknown) {
	if (!body) return 'empty response body';

	try {
		const json = JSON.stringify(body);
		return json.length > 500 ? `${json.slice(0, 500)}...` : json;
	} catch {
		return 'unserializable response body';
	}
}
