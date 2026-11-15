<script lang="ts">
	let { issues }: { issues: { message: string }[] | undefined } = $props();
</script>

{#if issues?.length}
	<div role="alert" class="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
		{#each issues as issue (issue.message)}
			<p>{issue.message}</p>
		{/each}
	</div>
{/if}
