<script lang="ts">
	import { signIn, signOut } from '@auth/sveltekit/client';
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';

	let { children, data } = $props();
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<div class="min-h-screen bg-slate-50 text-slate-950">
	<header class="border-b border-slate-200 bg-white">
		<nav class="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
			<a href="/" class="text-lg font-semibold tracking-tight">Graphia</a>

			<div class="flex items-center gap-3">
				{#if data.session?.user}
					<span class="hidden text-sm text-slate-600 sm:inline">
						{data.session.user.name ?? data.session.user.email ?? 'Signed in'}
					</span>
					{#if data.session.user.image}
						<img
							class="h-8 w-8 rounded-full border border-slate-200"
							src={data.session.user.image}
							alt=""
						/>
					{/if}
					<button
						class="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-100"
						type="button"
						onclick={() => signOut()}
					>
						Sign out
					</button>
				{:else}
					<button
						class="rounded-md bg-slate-950 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
						type="button"
						onclick={() => signIn('github')}
					>
						Sign in with GitHub
					</button>
				{/if}
			</div>
		</nav>
	</header>

	<main class="mx-auto max-w-6xl px-6 py-10">
		{@render children()}
	</main>
</div>
