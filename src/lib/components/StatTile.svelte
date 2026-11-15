<script lang="ts">
	import TrendingDown from '@lucide/svelte/icons/trending-down';
	import TrendingUp from '@lucide/svelte/icons/trending-up';
	import * as Card from '#lib/components/ui/card/index.js';

	let { label, value, trend }: { label: string; value: number; trend?: number } = $props();

	const TrendIcon = $derived(trend !== undefined && trend < 0 ? TrendingDown : TrendingUp);
</script>

<Card.Root size="sm" class="gap-1 px-4">
	<h3 class="text-sm font-medium text-muted-foreground">{label}</h3>
	<div class="flex items-end gap-2">
		<p class="text-2xl font-bold tabular-nums">{value}</p>
		{#if trend !== undefined}
			<p
				class={[
					'flex items-center gap-1 pb-1 text-xs font-medium tabular-nums',
					trend > 0 && 'text-green-600 dark:text-green-500',
					trend < 0 && 'text-red-600 dark:text-red-500',
					trend === 0 && 'text-muted-foreground'
				]}
			>
				<TrendIcon class="size-3" aria-hidden="true" />
				<span>{trend > 0 ? '+' : ''}{trend}%</span>
				<span class="sr-only">vs previous period</span>
			</p>
		{/if}
	</div>
</Card.Root>
