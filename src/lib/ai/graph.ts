import type { GraphData } from '$lib/types';
import { z } from 'zod';
import { requestOpenRouter } from './openrouter';
import { graphPrompt } from './prompts';

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

	try {
		return JSON.parse(withoutFence);
	} catch {
		const start = withoutFence.indexOf('{');
		const end = withoutFence.lastIndexOf('}');
		if (start === -1 || end === -1 || end <= start) throw new Error('No JSON object found');
		return JSON.parse(withoutFence.slice(start, end + 1));
	}
}

function normalizeGraph(graph: GraphData): GraphData {
	const dedupedNodes = graph.nodes
		.filter((node, index, nodes) => nodes.findIndex((candidate) => candidate.id === node.id) === index)
		.slice(0, 18);
	const ids = new Set(dedupedNodes.map((node) => node.id));
	const edges = graph.edges.filter((edge) => ids.has(edge.from) && ids.has(edge.to) && edge.from !== edge.to);

	const incoming = new Set(edges.map((edge) => edge.to));
	for (const node of dedupedNodes) {
		if (node.level > 0 && !incoming.has(node.id)) {
			const prerequisite =
				dedupedNodes.find((candidate) => candidate.level < node.level) ?? dedupedNodes[0];
			if (prerequisite && prerequisite.id !== node.id) {
				edges.push({ from: prerequisite.id, to: node.id });
				incoming.add(node.id);
			}
		}
	}

	const normalized = { nodes: dedupedNodes, edges };
	if (normalized.nodes.length < 8) {
		throw new Error('Generated graph did not include enough valid nodes');
	}

	return normalized;
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
	const content = await requestOpenRouter(
		[{ role: 'user', content: graphPrompt(subject) }],
		{ type: 'json_object' }
	);
	const graph = graphDataSchema.parse(parseModelJson(content));
	const normalized = normalizeGraph(graph);
	assertValidGraph(normalized);

	return normalized;
}
