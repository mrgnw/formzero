<script lang="ts">
	import CheckIcon from '@lucide/svelte/icons/check';
	import ResultCard from '#lib/components/ResultCard.svelte';
</script>

<svelte:head>
	<title>Submission Successful</title>
	<meta name="description" content="Your form has been submitted successfully." />
</svelte:head>

<ResultCard
	title="Submission Successful!"
	description="Thank you for your submission. We've received your information and will get back to you soon."
>
	{#snippet icon()}
		<div class="mb-2 flex size-12 items-center justify-center rounded-full bg-green-100 text-green-600 dark:bg-green-950 dark:text-green-400">
			<CheckIcon aria-hidden="true" />
		</div>
	{/snippet}
</ResultCard>
