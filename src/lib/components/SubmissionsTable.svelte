<script lang="ts">
	import type { Snippet } from 'svelte';
	import ArrowDown from '@lucide/svelte/icons/arrow-down';
	import ArrowUp from '@lucide/svelte/icons/arrow-up';
	import ArrowUpDown from '@lucide/svelte/icons/arrow-up-down';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import * as Table from '#lib/components/ui/table/index.js';
	import type { Submission } from '#lib/server/dashboard.js';
	import { exactTime, timeAgo } from '#lib/time.js';

	type SortKey = 'created_at' | 'email';
	type Direction = 'ascending' | 'descending';

	let {
		submissions,
		now,
		toolbar,
		onDelete
	}: {
		submissions: Submission[];
		now: number;
		toolbar?: Snippet;
		onDelete: (submission: Submission) => void;
	} = $props();

	const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

	let query = $state('');
	let sort = $state<{ key: SortKey; direction: Direction }>({ key: 'created_at', direction: 'descending' });
	let announcement = $state('');

	const fields = $derived(
		[...new Set(submissions.flatMap((submission) => Object.keys(submission.data)))].sort((a, b) => {
			if (a === 'email') return -1;
			if (b === 'email') return 1;
			return a.localeCompare(b);
		})
	);
	const filtered = $derived.by(() => {
		if (!query.trim()) return submissions;
		const needle = query.toLowerCase();
		return submissions.filter((submission) => JSON.stringify(submission).toLowerCase().includes(needle));
	});
	const rows = $derived.by(() => {
		const factor = sort.direction === 'ascending' ? 1 : -1;
		return filtered.toSorted((a, b) => factor * compare(a, b, sort.key));
	});

	function text(value: unknown) {
		return value === undefined || value === null ? '' : String(value);
	}

	function compare(a: Submission, b: Submission, key: SortKey) {
		if (key === 'created_at') return a.created_at - b.created_at;
		return collator.compare(text(a.data.email), text(b.data.email));
	}

	function heading(field: string) {
		return field.charAt(0).toUpperCase() + field.slice(1);
	}

	function toggle(key: SortKey, label: string) {
		const direction: Direction =
			sort.key === key && sort.direction === 'ascending' ? 'descending' : 'ascending';
		sort = { key, direction };
		announcement = `Sorted by ${label}, ${direction}`;
	}
</script>

{#snippet sortableHead(key: SortKey, label: string)}
	<Table.Head aria-sort={sort.key === key ? sort.direction : undefined} class="px-0">
		<Button variant="ghost" onclick={() => toggle(key, label)}>
			{label}
			{#if sort.key !== key}
				<ArrowUpDown class="size-4" aria-hidden="true" />
			{:else if sort.direction === 'ascending'}
				<ArrowUp class="size-4" aria-hidden="true" />
			{:else}
				<ArrowDown class="size-4" aria-hidden="true" />
			{/if}
		</Button>
	</Table.Head>
{/snippet}

<div class="min-w-0 space-y-2">
	<div class="flex items-center justify-between gap-2">
		<Input type="search" bind:value={query} placeholder="Search submissions..." aria-label="Search submissions" class="max-w-sm" />
		{@render toolbar?.()}
	</div>
	<div class="rounded-md border">
		<Table.Root>
			<caption class="sr-only">Submissions</caption>
			<Table.Header>
				<Table.Row>
					{@render sortableHead('created_at', 'Time')}
					{#each fields as field (field)}
						{#if field === 'email'}
							{@render sortableHead('email', 'Email')}
						{:else}
							<Table.Head>{heading(field)}</Table.Head>
						{/if}
					{/each}
					<Table.Head><span class="sr-only">Actions</span></Table.Head>
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#each rows as submission (submission.id)}
					<Table.Row>
						<Table.Cell>
							<time
								class="text-sm text-muted-foreground"
								datetime={new Date(submission.created_at).toISOString()}
								title={exactTime(submission.created_at)}
							>
								{timeAgo(submission.created_at, now)}
							</time>
						</Table.Cell>
						{#each fields as field (field)}
							<Table.Cell>{text(submission.data[field])}</Table.Cell>
						{/each}
						<Table.Cell>
							<div class="flex justify-end">
								<Button
									variant="ghost"
									size="icon"
									class="size-8 text-muted-foreground hover:text-destructive"
									aria-label="Delete submission"
									onclick={() => onDelete(submission)}
								>
									<Trash2 class="size-4" aria-hidden="true" />
								</Button>
							</div>
						</Table.Cell>
					</Table.Row>
				{:else}
					<Table.Row>
						<Table.Cell colspan={fields.length + 2} class="h-24 text-center">
							{submissions.length === 0 ? 'No submissions yet.' : 'No matching submissions.'}
						</Table.Cell>
					</Table.Row>
				{/each}
			</Table.Body>
		</Table.Root>
	</div>
	<p class="text-sm text-muted-foreground">
		{filtered.length === submissions.length
			? `${submissions.length} total submission(s)`
			: `${filtered.length} of ${submissions.length} submission(s)`}
	</p>
	<p class="sr-only" role="status">{announcement}</p>
</div>
