<script lang="ts">
	import { goto } from '$app/navigation';
	import katex from 'katex';
	import { marked } from 'marked';
	import { parseExercises, stripExerciseAnswers } from '$lib/parseExercises';
	import 'katex/dist/katex.min.css';

	interface LessonPageData {
		session: App.PageData['session'];
		subject: { id: string; subject: string; status: string };
		lesson: {
			id: string;
			subjectId: string;
			nodeId: string;
			concept: string;
			content: string;
			createdAt: string;
		};
		prerequisites: Prerequisite[];
		locked: boolean;
		completed: boolean;
	}

	interface Prerequisite {
		id: string;
		nodeId: string;
		concept: string;
	}

	let { data } = $props<{
		data: LessonPageData;
	}>();

	const exercises = $derived(parseExercises(data.lesson.content));
	const renderedLesson = $derived(renderMarkdown(stripExerciseAnswers(data.lesson.content)));
	const prerequisiteText = $derived(
		data.prerequisites.map((item: Prerequisite) => item.concept).join(', ') || 'none'
	);
	let answers = $state<Record<number, string>>({});
	let score = $state<number | null>(null);
	let isSubmitting = $state(false);
	let errorMessage = $state('');

	function renderMarkdown(markdown: string) {
		const placeholders: string[] = [];
		const withMath = markdown
			.replace(/\$\$([\s\S]+?)\$\$/g, (_match, math) => {
				const index = placeholders.push(katex.renderToString(math, { displayMode: true, throwOnError: false }));
				return `@@MATH_${index - 1}@@`;
			})
			.replace(/\$([^$\n]+?)\$/g, (_match, math) => {
				const index = placeholders.push(katex.renderToString(math, { displayMode: false, throwOnError: false }));
				return `@@MATH_${index - 1}@@`;
			});

		const escapedMarkdown = withMath.replace(/[<>]/g, (character) =>
			character === '<' ? '&lt;' : '&gt;'
		);
		let html = marked.parse(escapedMarkdown, { async: false }) as string;
		placeholders.forEach((value, index) => {
			html = html.replace(`@@MATH_${index}@@`, value);
		});

		return html;
	}

	function checkAnswers() {
		if (exercises.length === 0) {
			score = 100;
			return;
		}

		const correct = exercises.filter((exercise, index) => {
			const answer = (answers[index] ?? '').trim().toLowerCase();
			return answer === exercise.answer;
		}).length;

		score = Math.round((correct / exercises.length) * 100);
	}

	async function submitProgress() {
		errorMessage = '';
		if (!data.session?.user) {
			errorMessage = 'Sign in before saving progress.';
			return;
		}
		if (!data.lesson.id) {
			errorMessage = 'Open the lesson after completing prerequisites.';
			return;
		}

		if (score === null) checkAnswers();
		const finalScore = score ?? 0;
		isSubmitting = true;

		try {
			const response = await fetch('/api/progress', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					subjectId: data.subject.id,
					nodeId: data.lesson.nodeId,
					score: finalScore
				})
			});

			const payload = await response.json();
			if (!response.ok) throw new Error(payload.error ?? 'Could not save progress');

			await goto(`/graph/${data.subject.id}`);
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Could not save progress';
			isSubmitting = false;
		}
	}
</script>

<div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
	<article class="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
		<div class="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-5">
			<div>
				<a class="text-sm font-medium text-teal-700 hover:text-teal-800" href={`/graph/${data.subject.id}`}>
					Back to graph
				</a>
				<h1 class="mt-2 text-3xl font-semibold tracking-tight">{data.lesson.concept}</h1>
				<p class="mt-1 text-sm text-slate-600">{data.subject.subject}</p>
			</div>
			{#if data.completed}
				<span class="rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700">
					Completed
				</span>
			{/if}
		</div>

		{#if data.locked}
			<div class="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
				Complete the prerequisite lessons before this one.
			</div>
		{:else}
			<div class="prose prose-slate max-w-none">
				{@html renderedLesson}
			</div>
		{/if}
	</article>

	<aside class="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
		<h2 class="text-lg font-semibold">Check your understanding</h2>
		<p class="mt-1 text-sm text-slate-600">Answer all 5 questions, then save your score.</p>

		{#if data.locked}
			<p class="mt-3 text-sm text-slate-600">
				Prerequisites:
				{prerequisiteText}
			</p>
		{:else if exercises.length === 0}
			<p class="mt-3 text-sm text-slate-600">No fill-in questions were generated for this lesson.</p>
			<button
				class="mt-5 w-full rounded-md bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800"
				type="button"
				onclick={() => void submitProgress()}
			>
				Mark complete
			</button>
		{:else}
			<div class="mt-4 space-y-4">
				{#each exercises as exercise, index}
					<label class="block">
						<span class="block text-sm leading-6 text-slate-700">{exercise.displayQuestion}</span>
						<input
							class="mt-2 w-full rounded-md border-slate-300 text-sm focus:border-teal-600 focus:ring-teal-600"
							bind:value={answers[index]}
							placeholder="Type the missing term"
						/>
					</label>
				{/each}
			</div>

			<div class="mt-5 grid grid-cols-2 gap-3">
				<button
					class="rounded-md border border-slate-300 px-4 py-2.5 text-sm font-semibold hover:bg-slate-50"
					type="button"
					onclick={checkAnswers}
				>
					Check
				</button>
				<button
					class="rounded-md bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-400"
					type="button"
					disabled={isSubmitting}
					onclick={() => void submitProgress()}
				>
					Save
				</button>
			</div>

			{#if score !== null}
				<p class="mt-4 rounded-md bg-slate-50 p-3 text-sm font-medium text-slate-800">Score: {score}%</p>
			{/if}
			{#if errorMessage}
				<p class="mt-3 text-sm text-red-700">{errorMessage}</p>
			{/if}
		{/if}
	</aside>
</div>
