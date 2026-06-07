import { env } from '$env/dynamic/private';
import type { GraphData } from '$lib/types';
import { z } from 'zod';
import { graphPrompt } from './prompts';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL = 'meta-llama/llama-3.3-70b-instruct:free';

const graphDataSchema = z.object({
	nodes: z
		.array(
			z.object({
				id: z.string().min(1),
				label: z.string().min(1),
				level: z.union([z.literal(0), z.literal(1), z.literal(2)]),
				summary: z.string().min(1)
			})
		)
		.min(8)
		.max(20),
	edges: z.array(
		z.object({
			from: z.string().min(1),
			to: z.string().min(1)
		})
	)
});

function parseModelJson(content: string): unknown {
	const trimmed = content.trim();
	const withoutFence = trimmed
		.replace(/^```(?:json)?\s*/i, '')
		.replace(/\s*```$/i, '')
		.trim();

	return JSON.parse(withoutFence);
}

function assertValidGraph(graph: GraphData) {
	const ids = new Set(graph.nodes.map((node) => node.id));

	if (ids.size !== graph.nodes.length) {
		throw new Error('Generated graph contains duplicate node IDs');
	}

	for (const edge of graph.edges) {
		if (!ids.has(edge.from) || !ids.has(edge.to)) {
			throw new Error('Generated graph contains an edge referencing a missing node');
		}
	}

	const incoming = new Map(graph.nodes.map((node) => [node.id, 0]));
	for (const edge of graph.edges) {
		incoming.set(edge.to, (incoming.get(edge.to) ?? 0) + 1);
	}

	for (const node of graph.nodes) {
		if (node.level > 0 && (incoming.get(node.id) ?? 0) === 0) {
			throw new Error(`Generated graph node "${node.label}" is missing prerequisites`);
		}
	}

	const visiting = new Set<string>();
	const visited = new Set<string>();
	const adjacency = new Map<string, string[]>();

	for (const edge of graph.edges) {
		adjacency.set(edge.from, [...(adjacency.get(edge.from) ?? []), edge.to]);
	}

	const visit = (id: string) => {
		if (visiting.has(id)) throw new Error('Generated graph contains a cycle');
		if (visited.has(id)) return;

		visiting.add(id);
		for (const next of adjacency.get(id) ?? []) visit(next);
		visiting.delete(id);
		visited.add(id);
	};

	for (const node of graph.nodes) visit(node.id);
}

export async function generateGraph(subject: string): Promise<GraphData> {
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
			messages: [{ role: 'user', content: graphPrompt(subject) }],
			response_format: { type: 'json_object' }
		})
	});

	if (!response.ok) {
		throw new Error(`OpenRouter graph request failed: ${response.status}`);
	}

	const data = await response.json();
	const content = data?.choices?.[0]?.message?.content;

	if (typeof content !== 'string') {
		throw new Error('OpenRouter graph response did not include message content');
	}

	const graph = graphDataSchema.parse(parseModelJson(content));
	assertValidGraph(graph);

	return graph;
}
