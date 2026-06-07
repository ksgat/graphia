<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { onMount } from 'svelte';
	import type { GraphEdge, GraphNode } from '$lib/types';
	import type { PageData } from './$types';
	import 'vis-network/styles/vis-network.css';

	let { data }: { data: PageData } = $props();

	let container = $state<HTMLDivElement>();
	let selectedNodeId = $state<string | null>(null);
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
	const selectedLesson = $derived(selectedNode ? lessonsByNode.get(selectedNode.id) : null);
	const selectedLocked = $derived(selectedNode ? isLocked(selectedNode.id) : false);

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
</script>

<div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
	<section class="min-h-[640px] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
		<div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
			<div>
				<p class="text-sm font-medium uppercase tracking-[0.14em] text-slate-500">Graph</p>
				<h1 class="text-2xl font-semibold tracking-tight">{data.subject.subject}</h1>
			</div>
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

		{#if data.subject.status === 'generating'}
			<div class="grid min-h-[560px] place-items-center px-6 text-center">
				<div>
					<div class="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-teal-700"></div>
					<p class="mt-5 font-medium">Generating graph and lessons...</p>
					<p class="mt-2 text-sm text-slate-600">This can take a minute on free models.</p>
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
				disabled={selectedLocked || !selectedLesson}
				onclick={() => selectedLesson && goto(`/lesson/${selectedLesson.id}`)}
			>
				Start lesson
			</button>
		{:else}
			<p class="text-sm text-slate-600">Select a node to inspect the concept and open its lesson.</p>
		{/if}
	</aside>
</div>
