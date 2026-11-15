<script lang="ts">
	import { page } from '$app/state';
	import XIcon from '@lucide/svelte/icons/x';
	import ResultCard from '#lib/components/ResultCard.svelte';

	const messages = {
		form_not_found: {
			title: 'Form Not Found',
			description: "The form you're trying to submit to doesn't exist. Please check the form URL and try again."
		},
		internal_error: {
			title: 'Something Went Wrong',
			description: 'We encountered an error while processing your submission. Please try again later.'
		},
		unsupported_content_type: {
			title: 'Unsupported Format',
			description: 'The format of your submission is not supported. Please check your form configuration.'
		}
	};

	const message = $derived.by(() => {
		const key = page.url.searchParams.get('error') ?? '';
		return Object.hasOwn(messages, key) ? messages[key as keyof typeof messages] : messages.internal_error;
	});
</script>

<svelte:head>
	<title>Error - FormZero</title>
	<meta name="description" content="An error occurred while processing your request." />
</svelte:head>

<ResultCard title={message.title} description={message.description}>
	{#snippet icon()}
		<div class="mb-2 flex size-12 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400">
			<XIcon aria-hidden="true" />
		</div>
	{/snippet}
</ResultCard>
