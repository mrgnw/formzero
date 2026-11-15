<script lang="ts">
	let { issues }: { issues: { message: string; path: (string | number)[] }[] | undefined } = $props();

	const formLevel = $derived(issues?.filter((issue) => issue.path.length === 0));
</script>

{#if formLevel?.length}
	<div role="alert" class="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
		{#each formLevel as issue (issue.message)}
			<p>{issue.message}</p>
		{/each}
	</div>
{/if}
