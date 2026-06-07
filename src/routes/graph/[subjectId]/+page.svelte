<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { onMount } from 'svelte';
	import type { GraphEdge, GraphNode } from '$lib/types';
	import type { PageData } from './$types';
	import 'vis-network/styles/vis-network.css';

	let { data }: { data: PageData } = $props();

	let container = $state<HTMLDivElement>();
	let selectedNodeId = $state<string | null>(null);
	let isRegenerating = $state(false);
	let regenerateError = $state('');
	let network: any = null;
	let renderedKey = '';

	const completedLessonIds = $derived(
		new Set(data.progress.filter((item) => item.completed).map((item) => item.lessonId))
	);
	const lessonsByNode = $derived(new Map(data.lessons.map((lesson) => [lesson.nodeId, lesson])));
	const completedNodeIds = $derived(
		new Set(data.lessons.filter((lesson) => completedLessonIds.has(lesson.id)).map((lesson) => lesson.nodeId))
	);
	const selectedNode = $derived(data.graph?.nodes.find((node) => node.id === selectedNodeId) ?? null);
	const selectedLocked = $derived(selectedNode ? isLocked(selectedNode.id) : false);
	const canRegenerate = $derived(data.session?.user?.id === data.subject.userId);
	const pathway = $derived(getPathway());
	const nextLesson = $derived(pathway.find((item) => !item.completed && !item.locked) ?? null);
	const milestones = $derived(getMilestones());

	const levelStyles = {
		0: { color: { background: '#E1F5EE', border: '#0F6E56' }, font: { color: '#085041' } },
		1: { color: { background: '#EEEDFE', border: '#534AB7' }, font: { color: '#3C3489' } },
		2: { color: { background: '#FAEEDA', border: '#854F0B' }, font: { color: '#633806' } }
	} as const;

	onMount(() => {
		const interval = window.setInterval(() => {
			if (data.subject.status === 'generating') void invalidateAll();
		}, 3000);

		return () => {
			window.clearInterval(interval);
			network?.destroy();
		};
	});

	$effect(() => {
		if (!container || !data.graph) return;

		const key = `${data.graph.id}:${data.lessons.length}:${data.progress.length}`;
		if (key === renderedKey) return;

		renderedKey = key;
		void renderNetwork(data.graph.nodes, data.graph.edges);
	});

	function isLocked(nodeId: string) {
		if (!data.graph) return true;

		const prerequisites = data.graph.edges.filter((edge) => edge.to === nodeId).map((edge) => edge.from);
		return prerequisites.some((id) => !completedNodeIds.has(id));
	}

	function prerequisiteCount(nodeId: string) {
		return data.graph?.edges.filter((edge) => edge.to === nodeId).length ?? 0;
	}

	function getPathway() {
		if (!data.graph) return [];

		return data.graph.nodes
			.map((node) => ({
				node,
				lesson: lessonsByNode.get(node.id),
				completed: completedNodeIds.has(node.id),
				locked: isLocked(node.id),
				prerequisiteCount: prerequisiteCount(node.id)
			}))
			.sort((a, b) => {
				if (a.completed !== b.completed) return a.completed ? 1 : -1;
				if (a.locked !== b.locked) return a.locked ? 1 : -1;
				if (a.node.level !== b.node.level) return a.node.level - b.node.level;
				return a.prerequisiteCount - b.prerequisiteCount;
			});
	}

	function getMilestones() {
		if (!data.graph) return [];

		return [0, 1, 2].map((level) => {
			const nodes = data.graph?.nodes.filter((node) => node.level === level) ?? [];
			const completed = nodes.filter((node) => completedNodeIds.has(node.id)).length;

			return {
				level,
				label: ['Foundations', 'Working Concepts', 'Advanced Use'][level],
				total: nodes.length,
				completed,
				done: nodes.length > 0 && completed === nodes.length
			};
		});
	}

	async function renderNetwork(nodes: GraphNode[], edges: GraphEdge[]) {
		if (!container) return;

		const [{ Network }, { DataSet }] = await Promise.all([import('vis-network/standalone'), import('vis-data')]);

		network?.destroy();

		const graphNodes = nodes.map((node) => {
			const locked = isLocked(node.id);
			const completed = completedNodeIds.has(node.id);
			const style = levelStyles[node.level];

			return {
				id: node.id,
				label: node.label,
				title: node.summary,
				shape: 'box',
				margin: { top: 10, right: 12, bottom: 10, left: 12 },
				borderWidth: completed ? 4 : 2,
				color: {
					...style.color,
					border: completed ? '#22c55e' : style.color.border
				},
				font: style.font,
				opacity: locked ? 0.35 : 1
			};
		});

		network = new Network(
			container,
			{
				nodes: new DataSet(graphNodes as any) as any,
				edges: new DataSet(
					edges.map((edge) => ({
						...edge,
						arrows: 'to',
						color: '#94a3b8',
						smooth: { type: 'cubicBezier', forceDirection: 'vertical', roundness: 0.35 }
					})) as any
				) as any
			},
			{
				autoResize: true,
				layout: {
					hierarchical: {
						enabled: true,
						direction: 'UD',
						sortMethod: 'directed',
						levelSeparation: 130,
						nodeSpacing: 180
					}
				},
				physics: false,
				interaction: {
					hover: true,
					navigationButtons: true
				}
			}
		);

		network.on('click', (params: { nodes?: unknown[] }) => {
			const nodeId = params.nodes?.[0];
			selectedNodeId = typeof nodeId === 'string' ? nodeId : null;
		});
	}

	async function regenerate() {
		regenerateError = '';
		isRegenerating = true;

		try {
			const response = await fetch('/api/regenerate', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ subjectId: data.subject.id })
			});
			const payload = await response.json();

			if (!response.ok) {
				throw new Error(payload.error ?? 'Regeneration failed');
			}

			await invalidateAll();
		} catch (error) {
			regenerateError = error instanceof Error ? error.message : 'Regeneration failed';
		} finally {
			isRegenerating = false;
		}
	}
</script>

<div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
	<section class="min-h-[640px] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
		<div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
			<div>
				<p class="text-sm font-medium uppercase tracking-[0.14em] text-slate-500">Graph</p>
				<h1 class="text-2xl font-semibold tracking-tight">{data.subject.subject}</h1>
			</div>
			<div class="flex items-center gap-3">
				{#if canRegenerate}
					<button
						class="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
						type="button"
						disabled={isRegenerating}
						onclick={() => void regenerate()}
					>
						{isRegenerating ? 'Regenerating...' : 'Regenerate'}
					</button>
				{/if}
				<span
					class={[
						'rounded-full px-3 py-1 text-sm font-medium',
						data.subject.status === 'done'
							? 'bg-emerald-50 text-emerald-700'
							: data.subject.status === 'failed'
								? 'bg-red-50 text-red-700'
								: 'bg-amber-50 text-amber-700'
					]}
				>
					{data.subject.status}
				</span>
			</div>
		</div>

		{#if regenerateError}
			<div class="border-b border-red-100 bg-red-50 px-5 py-3 text-sm text-red-700">
				{regenerateError}
			</div>
		{/if}

		{#if data.subject.status === 'generating'}
			<div class="grid min-h-[560px] place-items-center px-6 text-center">
				<div>
					<div class="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-teal-700"></div>
					<p class="mt-5 font-medium">Generating graph...</p>
					<p class="mt-2 text-sm text-slate-600">Lessons are generated when you open each node.</p>
				</div>
			</div>
		{:else if data.subject.status === 'failed'}
			<div class="px-5 py-8">
				<p class="font-medium text-red-700">Generation failed.</p>
				<p class="mt-2 text-sm text-slate-600">{data.subject.error ?? 'No error message was saved.'}</p>
			</div>
		{:else if data.graph}
			<div bind:this={container} class="h-[560px] w-full"></div>
		{/if}
	</section>

	<aside class="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
		{#if nextLesson}
			<div class="mb-5 rounded-lg border border-teal-100 bg-teal-50 p-4">
				<p class="text-xs font-semibold uppercase tracking-[0.16em] text-teal-800">Recommended next</p>
				<h2 class="mt-2 text-lg font-semibold text-slate-950">{nextLesson.node.label}</h2>
				<p class="mt-2 text-sm leading-6 text-slate-700">{nextLesson.node.summary}</p>
				<button
					class="mt-4 w-full rounded-md bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-400"
					type="button"
					onclick={() => goto(`/lesson/${data.subject.id}/${nextLesson.node.id}`)}
				>
					Start this lesson
				</button>
			</div>
		{/if}

		{#if data.graph}
			<div class="mb-5">
				<h2 class="text-sm font-semibold uppercase tracking-[0.14em] text-slate-500">Milestones</h2>
				<div class="mt-3 space-y-2">
					{#each milestones as milestone}
						<div class="rounded-md bg-slate-50 p-3">
							<div class="flex items-center justify-between gap-3">
								<span class="text-sm font-medium">{milestone.label}</span>
								<span
									class={[
										'rounded-full px-2 py-0.5 text-xs font-medium',
										milestone.done ? 'bg-emerald-100 text-emerald-800' : 'bg-white text-slate-600'
									]}
								>
									{milestone.completed}/{milestone.total}
								</span>
							</div>
							<div class="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
								<div
									class="h-full rounded-full bg-teal-700"
									style={`width: ${milestone.total ? (milestone.completed / milestone.total) * 100 : 0}%`}
								></div>
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/if}

		{#if selectedNode}
			<p class="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Selected concept</p>
			<h2 class="mt-3 text-xl font-semibold">{selectedNode.label}</h2>
			<p class="mt-3 text-sm leading-6 text-slate-600">{selectedNode.summary}</p>

			<div class="mt-5 rounded-md bg-slate-50 p-3 text-sm text-slate-700">
				Level {selectedNode.level + 1}
				{#if completedNodeIds.has(selectedNode.id)}
					<span class="ml-2 font-medium text-emerald-700">Completed</span>
				{:else if selectedLocked}
					<span class="ml-2 font-medium text-slate-500">Locked</span>
				{/if}
			</div>

			<button
				class="mt-5 w-full rounded-md bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-400"
				type="button"
				disabled={selectedLocked}
				onclick={() => selectedNode && goto(`/lesson/${data.subject.id}/${selectedNode.id}`)}
			>
				Start lesson
			</button>
		{:else}
			<p class="text-sm text-slate-600">Select a node to inspect the concept and open its lesson.</p>
		{/if}

		{#if pathway.length > 0}
			<div class="mt-6 border-t border-slate-200 pt-5">
				<h2 class="text-sm font-semibold uppercase tracking-[0.14em] text-slate-500">Pathway</h2>
				<div class="mt-3 max-h-80 space-y-2 overflow-auto pr-1">
					{#each pathway as item, index}
						<button
							class={[
								'w-full rounded-md border px-3 py-2 text-left text-sm',
								item.completed
									? 'border-emerald-200 bg-emerald-50 text-emerald-900'
									: item.locked
										? 'border-slate-200 bg-slate-50 text-slate-400'
										: 'border-teal-200 bg-white text-slate-900 hover:bg-teal-50'
							]}
							type="button"
							onclick={() => {
								selectedNodeId = item.node.id;
							}}
						>
							<span class="font-medium">{index + 1}. {item.node.label}</span>
							<span class="mt-1 block text-xs">
								{item.completed ? 'Complete' : item.locked ? 'Locked' : 'Ready'} / Level {item.node.level + 1}
							</span>
						</button>
					{/each}
				</div>
			</div>
		{/if}
	</aside>
</div>
