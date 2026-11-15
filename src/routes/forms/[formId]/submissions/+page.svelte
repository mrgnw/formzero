<script lang="ts">
	import Download from '@lucide/svelte/icons/download';
	import Inbox from '@lucide/svelte/icons/inbox';
	import DeleteSubmissionDialog from '#lib/components/DeleteSubmissionDialog.svelte';
	import StatTile from '#lib/components/StatTile.svelte';
	import SubmissionsChart from '#lib/components/SubmissionsChart.svelte';
	import SubmissionsTable from '#lib/components/SubmissionsTable.svelte';
	import { Button } from '#lib/components/ui/button/index.js';
	import * as Empty from '#lib/components/ui/empty/index.js';
	import type { Submission } from '#lib/server/dashboard.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let pendingDelete = $state<Submission | null>(null);
</script>

<svelte:head>
	<title>Submissions | FormZero</title>
	<meta name="description" content="View and manage form submissions" />
</svelte:head>

<div class="@container flex min-w-0 flex-1 flex-col gap-2">
	<div class="grid min-w-0 gap-2 @xl:grid-cols-2 @3xl:grid-cols-3">
		<StatTile label="Total Submissions" value={data.stats.total} />
		<StatTile label="This Week" value={data.stats.thisWeek} trend={data.stats.weekTrend} />
		<StatTile label="This Month" value={data.stats.thisMonth} trend={data.stats.monthTrend} />
	</div>

	<SubmissionsChart days={data.days} />

	{#if data.submissions.length === 0}
		<div class="flex min-w-0 flex-1 items-center justify-center py-12">
			<Empty.Root>
				<Empty.Header>
					<Empty.Media variant="icon">
						<Inbox aria-hidden="true" />
					</Empty.Media>
					<Empty.Title>No submissions yet</Empty.Title>
					<Empty.Description>Get started by sending your first submission to this form.</Empty.Description>
				</Empty.Header>
				<Empty.Content>
					<Button href="/forms/{data.form.id}/integration">Integrate</Button>
				</Empty.Content>
			</Empty.Root>
		</div>
	{:else}
		<SubmissionsTable submissions={data.submissions} now={data.now} onDelete={(submission) => (pendingDelete = submission)}>
			{#snippet toolbar()}
				<Button
					variant="outline"
					size="sm"
					href="/forms/{data.form.id}/submissions.csv"
					download
					class="h-9 gap-1.5 text-xs"
				>
					<Download class="size-3" aria-hidden="true" />
					Export CSV
				</Button>
			{/snippet}
		</SubmissionsTable>
	{/if}
</div>

<DeleteSubmissionDialog bind:submission={pendingDelete} />
