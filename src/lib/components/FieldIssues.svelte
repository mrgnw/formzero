<script lang="ts">
	let { id, issues }: { id: string; issues: { message: string }[] | undefined } = $props();
</script>

{#if issues?.length}
	<p {id} class="text-sm text-destructive">
		{#each issues as issue (issue.message)}
			<span class="block">{issue.message}</span>
		{/each}
	</p>
{/if}
