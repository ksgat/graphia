<script lang="ts">
	import { goto } from '$app/navigation';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let subject = $state('');
	let isGenerating = $state(false);
	let errorMessage = $state('');

	async function generateSubject() {
		errorMessage = '';

		if (!data.session?.user) {
			errorMessage = 'Sign in with GitHub before generating a graph.';
			return;
		}

		const trimmed = subject.trim();
		if (trimmed.length < 2) {
			errorMessage = 'Enter a subject with at least 2 characters.';
			return;
		}

		isGenerating = true;

		try {
			const response = await fetch('/api/generate', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ subject: trimmed })
			});
			const payload = await response.json();

			if (!response.ok) {
				throw new Error(payload.error ?? 'Generation failed');
			}

			await goto(`/graph/${payload.subjectId}`);
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Generation failed';
			isGenerating = false;
		}
	}
</script>

<section class="grid gap-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(360px,1.05fr)]">
	<div class="flex min-h-[360px] flex-col justify-center">
		<p class="text-sm font-semibold uppercase tracking-[0.16em] text-teal-700">Knowledge graph tutor</p>
		<h1 class="mt-4 max-w-2xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
			Map the path into any subject.
		</h1>
		<p class="mt-5 max-w-xl text-base leading-7 text-slate-600">
			Enter a topic and Graphia builds a prerequisite graph with a lesson attached to every
			concept.
		</p>

		<form class="mt-8 max-w-xl" onsubmit={(event) => { event.preventDefault(); void generateSubject(); }}>
			<label class="text-sm font-medium text-slate-800" for="subject">What do you want to learn?</label>
			<div class="mt-2 flex flex-col gap-3 sm:flex-row">
				<input
					id="subject"
					class="min-h-11 flex-1 rounded-md border-slate-300 bg-white px-4 text-base shadow-sm focus:border-teal-600 focus:ring-teal-600"
					placeholder="Quantum computing, jazz harmony, contract law..."
					bind:value={subject}
					disabled={isGenerating}
				/>
				<button
					class="min-h-11 rounded-md bg-teal-700 px-5 text-sm font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-400"
					type="submit"
					disabled={isGenerating}
				>
					{isGenerating ? 'Generating...' : 'Generate graph'}
				</button>
			</div>
			{#if errorMessage}
				<p class="mt-3 text-sm text-red-700">{errorMessage}</p>
			{/if}
		</form>
	</div>

	<div class="min-h-[360px] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
		<div class="border-b border-slate-200 px-5 py-4">
			<h2 class="text-sm font-semibold uppercase tracking-[0.14em] text-slate-500">Community subjects</h2>
		</div>

		<div class="divide-y divide-slate-100">
			{#if data.subjects.length === 0}
				<div class="px-5 py-8 text-sm text-slate-600">No subjects yet. Generate the first graph.</div>
			{:else}
				{#each data.subjects as item}
					<a class="block px-5 py-4 hover:bg-slate-50" href={`/graph/${item.id}`}>
						<div class="flex items-start justify-between gap-4">
							<div class="min-w-0">
								<h3 class="truncate text-base font-semibold text-slate-950">{item.subject}</h3>
								<p class="mt-1 text-sm text-slate-600">
									{item.nodeCount || 'Pending'} nodes
									<span class="text-slate-300">/</span>
									{new Date(item.createdAt).toLocaleDateString()}
								</p>
							</div>

							<div class="flex shrink-0 items-center gap-3">
								<span
									class={[
										'rounded-full px-2.5 py-1 text-xs font-medium',
										item.status === 'done'
											? 'bg-emerald-50 text-emerald-700'
											: item.status === 'failed'
												? 'bg-red-50 text-red-700'
												: 'bg-amber-50 text-amber-700'
									]}
								>
									{item.status}
								</span>
								{#if item.authorImage}
									<img class="h-8 w-8 rounded-full" src={item.authorImage} alt="" />
								{/if}
							</div>
						</div>
					</a>
				{/each}
			{/if}
		</div>
	</div>
</section>
