<script lang="ts">
	import type { Snippet } from 'svelte';
	import * as Card from '#lib/components/ui/card/index.js';

	let { title, description, icon }: { title: string; description: string; icon: Snippet } = $props();
</script>

<main class="flex min-h-svh items-center justify-center bg-muted p-4">
	<Card.Root class="w-full max-w-md text-center">
		<Card.Header class="justify-items-center">
			{@render icon()}
			<Card.Title class="text-2xl font-bold">
				<h1>{title}</h1>
			</Card.Title>
			<Card.Description>{description}</Card.Description>
		</Card.Header>
	</Card.Root>
</main>
