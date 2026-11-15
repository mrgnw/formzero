<script lang="ts">
	import Check from '@lucide/svelte/icons/check';
	import Copy from '@lucide/svelte/icons/copy';
	import { Button, type ButtonProps } from '#lib/components/ui/button/index.js';

	let {
		text,
		label,
		labelClass = 'sr-only',
		...rest
	}: Omit<ButtonProps, 'children' | 'onclick'> & { text: string; label: string; labelClass?: string } = $props();

	let status = $state('');
	let timer: ReturnType<typeof setTimeout> | undefined;

	async function copy() {
		clearTimeout(timer);
		try {
			await navigator.clipboard.writeText(text);
			status = 'Copied!';
		} catch {
			status = 'Copy failed';
		}
		timer = setTimeout(() => (status = ''), 2000);
	}
</script>

<Button type="button" {...rest} onclick={copy}>
	{#if status === 'Copied!'}
		<Check aria-hidden="true" />
	{:else}
		<Copy aria-hidden="true" />
	{/if}
	<span class={labelClass}>{status || label}</span>
</Button>
<span role="status" class="sr-only">{status}</span>
