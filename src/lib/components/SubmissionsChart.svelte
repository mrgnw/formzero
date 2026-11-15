<script lang="ts">
	import * as Card from '#lib/components/ui/card/index.js';
	import type { DailyCount } from '#lib/server/dashboard.js';

	let { days }: { days: DailyCount[] } = $props();

	const TICK_COUNT = 4;
	const LABEL_INDEXES = [0, 7, 14, 22, 29];

	const max = $derived(Math.max(0, ...days.map((day) => day.count)));
	const step = $derived(Math.max(1, Math.ceil(max / TICK_COUNT)));
	const top = $derived(step * TICK_COUNT);
	const ticks = $derived(Array.from({ length: TICK_COUNT + 1 }, (_, index) => index * step));
	const xStep = $derived(100 / (days.length - 1));
	const points = $derived(
		days.map((day, index) => `${index * xStep},${100 - (day.count / top) * 100}`).join(' ')
	);
	const total = $derived(days.reduce((sum, day) => sum + day.count, 0));
	const busiest = $derived(days.reduce((best, day) => (day.count > best.count ? day : best), days[0]));
	const summary = $derived(
		total === 0
			? `No submissions in the last 30 days.`
			: `${total} submissions in the last 30 days, from ${days[0].date} to ${days.at(-1)?.date}. Busiest day: ${busiest.date} with ${busiest.count}.`
	);

	function label(day: DailyCount) {
		return `${day.date}: ${day.count} ${day.count === 1 ? 'submission' : 'submissions'}`;
	}
</script>

<Card.Root size="sm">
	<Card.Header>
		<Card.Title>Last 30 Days</Card.Title>
	</Card.Header>
	<Card.Content>
		<p class="sr-only">{summary}</p>
		<div class="chart" aria-hidden="true">
			<div class="y-axis">
				{#each ticks as tick (tick)}
					<span style:bottom="{(tick / top) * 100}%">{tick}</span>
				{/each}
			</div>
			<svg viewBox="0 0 100 100" preserveAspectRatio="none">
				{#each ticks as tick (tick)}
					<line class="grid" x1="0" x2="100" y1={100 - (tick / top) * 100} y2={100 - (tick / top) * 100} />
				{/each}
				<polyline {points} />
				{#each days as day, index (day.date)}
					<rect
						class="hit"
						x={Math.max(0, (index - 0.5) * xStep)}
						width={index === 0 || index === days.length - 1 ? xStep / 2 : xStep}
						y="0"
						height="100"
					>
						<title>{label(day)}</title>
					</rect>
				{/each}
			</svg>
			<div class="x-axis">
				{#each LABEL_INDEXES as index (index)}
					<span style:left="{index * xStep}%">{days[index].date}</span>
				{/each}
			</div>
		</div>
	</Card.Content>
</Card.Root>

<style>
	.chart {
		display: grid;
		grid-template-columns: 2rem 1fr;
		grid-template-rows: 140px auto;
		column-gap: 0.5rem;
		row-gap: 0.5rem;
		font-size: 0.75rem;
		color: var(--muted-foreground);
		font-variant-numeric: tabular-nums;
	}

	.y-axis,
	.x-axis {
		position: relative;
	}

	.y-axis span {
		position: absolute;
		right: 0;
		translate: 0 50%;
	}

	.x-axis {
		grid-column: 2;
		height: 1lh;
	}

	.x-axis span {
		position: absolute;
		translate: -50% 0;
		white-space: nowrap;
	}

	.x-axis span:first-child {
		translate: 0 0;
	}

	.x-axis span:last-child {
		translate: -100% 0;
	}

	svg {
		width: 100%;
		height: 100%;
		overflow: visible;
	}

	.grid {
		stroke: var(--border);
		stroke-width: 1;
		vector-effect: non-scaling-stroke;
	}

	polyline {
		fill: none;
		stroke: var(--chart-2);
		stroke-width: 2;
		stroke-linejoin: round;
		vector-effect: non-scaling-stroke;
	}

	.hit {
		fill: transparent;
	}

	.hit:hover {
		fill: color-mix(in oklch, var(--chart-2) 12%, transparent);
	}
</style>
