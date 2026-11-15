<script lang="ts">
	import Check from '@lucide/svelte/icons/check';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import { Button, type ButtonProps } from '#lib/components/ui/button/index.js';
	import { cn } from '#lib/utils.js';

	let {
		pending,
		done = false,
		pendingLabel,
		doneLabel = 'Saved!',
		class: className,
		children,
		...rest
	}: ButtonProps & { pending: boolean; done?: boolean; pendingLabel: string; doneLabel?: string } = $props();
</script>

<Button
	type="submit"
	{...rest}
	class={cn(done && 'bg-green-600 hover:bg-green-600', className)}
	disabled={rest.disabled || pending || done}
>
	{#if pending}
		<LoaderCircle class="size-4 animate-spin" />
		{pendingLabel}
	{:else if done}
		<Check class="size-4" />
		{doneLabel}
	{:else}
		{@render children?.()}
	{/if}
</Button>
