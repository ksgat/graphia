<script lang="ts">
	import { signIn } from '@auth/sveltekit/client';
</script>

<section class="-mx-6 -mt-10 min-h-[calc(100vh-73px)] bg-slate-900 px-6 text-white">
	<div class="mx-auto grid min-h-[calc(100vh-73px)] max-w-6xl items-center py-16">
		<div class="max-w-2xl">
			<p class="text-sm font-semibold uppercase tracking-[0.16em] text-slate-300">
				Graphia
			</p>
			<h1 class="mt-5 text-5xl font-semibold tracking-tight text-white sm:text-6xl">
				Learn any subject through a prerequisite graph.
			</h1>
			<p class="mt-6 max-w-xl text-lg leading-8 text-slate-300">
				Generate a topic map, follow the next recommended lesson, and cache each AI lesson
				as you open it.
			</p>

			<div class="mt-8 flex flex-wrap gap-3">
				<button
					class="rounded-md bg-white px-5 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-100"
					type="button"
					onclick={() => signIn('github', { redirectTo: '/app' })}
				>
					Sign in with GitHub
				</button>
			</div>
		</div>
	</div>
</section>
