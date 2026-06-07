<script lang="ts">
	import LessonPage from '../LessonPage.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<LessonPage {data} />
