<script lang="ts">
	import type { Snippet } from 'svelte';
	import * as Card from '#lib/components/ui/card/index.js';

	let {
		title,
		description,
		children
	}: { title: string; description: string; children: Snippet } = $props();
</script>

<main class="flex min-h-screen items-center justify-center bg-background p-4">
	<Card.Root class="w-full max-w-md gap-8 rounded-none border-0 bg-transparent py-0 text-base shadow-none ring-0 [--card-spacing:0px]">
		<Card.Header class="text-center">
			<Card.Title class="text-3xl font-bold"><h1>{title}</h1></Card.Title>
			<Card.Description class="mt-1 text-base">{description}</Card.Description>
		</Card.Header>
		<Card.Content class="gap-0">
			{@render children()}
		</Card.Content>
	</Card.Root>
</main>
