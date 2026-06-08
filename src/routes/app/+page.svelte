<script lang="ts">
	import { goto } from '$app/navigation';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let subject = $state('');
	let communitySearch = $state('');
	let isGenerating = $state(false);
	let errorMessage = $state('');
	let filteredSubjects = $derived.by(() => {
		const query = communitySearch.trim().toLowerCase();
		if (!query) return data.subjects;

		return data.subjects.filter((item) => getSubjectSearchText(item).includes(query));
	});

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

	function getSubjectSearchText(item: PageData['subjects'][number]) {
		return [
			item.subject,
			item.status,
			item.error,
			item.authorName,
			`${item.nodeCount} nodes`,
			item.nodeCount ? 'ready' : 'pending',
			new Date(item.createdAt).toLocaleDateString()
		]
			.filter(Boolean)
			.join(' ')
			.toLowerCase();
	}

	function statusClass(status: string) {
		if (status === 'done') return 'bg-sky-50 text-sky-800 ring-sky-100';
		if (status === 'failed') return 'bg-red-50 text-red-700 ring-red-100';
		return 'bg-amber-50 text-amber-700 ring-amber-100';
	}
</script>

<section class="space-y-10">
	<div class="max-w-3xl">
		<p class="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">Knowledge graph tutor</p>
		<h1 class="mt-4 max-w-2xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
			Map the path into any subject.
		</h1>
		<p class="mt-5 max-w-xl text-base leading-7 text-slate-600">
			Enter a topic and Graphia builds a prerequisite graph. Lessons generate and cache when
			you open a node.
		</p>

		<form
			class="mt-8 max-w-xl"
			onsubmit={(event) => {
				event.preventDefault();
				void generateSubject();
			}}
		>
			<label class="text-sm font-medium text-slate-800" for="subject">What do you want to learn?</label>
			<div class="mt-2 flex flex-col gap-3 sm:flex-row">
				<input
					id="subject"
					class="min-h-11 flex-1 rounded-md border-slate-300 bg-white px-4 text-base shadow-sm focus:border-slate-500 focus:ring-slate-500"
					placeholder="Quantum computing, jazz harmony, contract law..."
					bind:value={subject}
					disabled={isGenerating}
				/>
				<button
					class="min-h-11 rounded-md bg-slate-800 px-5 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
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

	{#if data.jumpBack}
		<div class="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
			<div class="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
				<div class="min-w-0">
					<p class="text-sm font-semibold uppercase tracking-[0.14em] text-slate-500">Jump back in</p>
					<h2 class="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
						{data.jumpBack.nodeLabel}
					</h2>
					<p class="mt-1 text-sm text-slate-600">
						{data.jumpBack.subject}
						<span class="text-slate-300">/</span>
						Last opened {new Date(data.jumpBack.lastAccessedAt).toLocaleDateString()}
						{#if data.jumpBack.score !== null}
							<span class="text-slate-300">/</span>
							Score {data.jumpBack.score}%
						{/if}
					</p>
					{#if data.jumpBack.nodeSummary}
						<p class="mt-3 max-w-3xl text-sm leading-6 text-slate-600">{data.jumpBack.nodeSummary}</p>
					{/if}
				</div>

				<div class="flex shrink-0 flex-col gap-3 sm:flex-row lg:flex-col">
					<a
						class="inline-flex min-h-11 items-center justify-center rounded-md bg-slate-800 px-5 text-sm font-semibold text-white hover:bg-slate-700"
						href={`/lesson/${data.jumpBack.subjectId}/${data.jumpBack.nodeId}`}
					>
						Continue lesson
					</a>
					{#if data.jumpBack.nextNode}
						<a
							class="inline-flex min-h-11 items-center justify-center rounded-md border border-slate-300 px-5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
							href={`/lesson/${data.jumpBack.subjectId}/${data.jumpBack.nextNode.id}`}
						>
							Next: {data.jumpBack.nextNode.label}
						</a>
					{/if}
				</div>
			</div>
		</div>
	{/if}

	<div>
		<div class="flex flex-col gap-4 border-t border-slate-200 pt-8 sm:flex-row sm:items-end sm:justify-between">
			<div>
				<h2 class="text-sm font-semibold uppercase tracking-[0.14em] text-slate-500">
					Community subjects
				</h2>
				<p class="mt-2 text-sm text-slate-600">
					Browse generated graphs and open any path that looks useful.
				</p>
			</div>

			<label class="w-full sm:max-w-xs">
				<span class="sr-only">Search community subjects</span>
				<input
					class="min-h-11 w-full rounded-md border-slate-300 bg-white px-4 text-sm shadow-sm focus:border-slate-500 focus:ring-slate-500"
					placeholder="Search subjects..."
					bind:value={communitySearch}
				/>
			</label>
		</div>

		<div class="mt-5">
			{#if data.subjects.length === 0}
				<div class="rounded-lg border border-dashed border-slate-300 bg-white px-5 py-8 text-sm text-slate-600">
					No subjects yet. Generate the first graph.
				</div>
			{:else if filteredSubjects.length === 0}
				<div class="rounded-lg border border-dashed border-slate-300 bg-white px-5 py-8 text-sm text-slate-600">
					No community subjects match "{communitySearch.trim()}".
				</div>
			{:else}
				<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{#each filteredSubjects as item}
						<a
							class="group flex min-h-40 flex-col justify-between rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
							href={`/graph/${item.id}`}
						>
							<div>
								<div class="flex items-start justify-between gap-3">
									<h3 class="min-w-0 text-lg font-semibold leading-6 text-slate-950">
										{item.subject}
									</h3>
									{#if item.authorImage}
										<img
											class="h-8 w-8 shrink-0 rounded-full border border-slate-200"
											src={item.authorImage}
											alt=""
										/>
									{/if}
								</div>

								<p class="mt-3 text-sm text-slate-600">
									{item.nodeCount ? `${item.nodeCount} nodes` : 'Graph pending'}
									<span class="text-slate-300">/</span>
									{new Date(item.createdAt).toLocaleDateString()}
								</p>
								{#if item.authorName}
									<p class="mt-1 truncate text-sm text-slate-500">by {item.authorName}</p>
								{/if}
							</div>

							<div class="mt-5 flex items-center justify-between gap-3">
								<span
									class={[
										'rounded-full px-2.5 py-1 text-xs font-medium ring-1',
										statusClass(item.status)
									]}
								>
									{item.status}
								</span>
								<span class="text-sm font-medium text-slate-500 group-hover:text-slate-950">
									Open
								</span>
							</div>
						</a>
					{/each}
				</div>
			{/if}
		</div>
	</div>
</section>
