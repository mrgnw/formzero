<script lang="ts">
	import type { Snippet } from 'svelte';
	import ArrowDown from '@lucide/svelte/icons/arrow-down';
	import ArrowUp from '@lucide/svelte/icons/arrow-up';
	import ArrowUpDown from '@lucide/svelte/icons/arrow-up-down';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import { page } from '$app/state';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import * as Table from '#lib/components/ui/table/index.js';
	import type { Direction, Sort, SortKey, Submission, SubmissionPage } from '#lib/server/dashboard.js';
	import { exactTime, timeAgo } from '#lib/time.js';

	let {
		table,
		query,
		sort,
		total,
		now,
		toolbar,
		onDelete
	}: {
		table: SubmissionPage;
		query: string;
		sort: Sort;
		total: number;
		now: number;
		toolbar?: Snippet;
		onDelete: (submission: Submission) => void;
	} = $props();

	const SORT_PARAMS: Record<SortKey, string> = { created_at: 'time', email: 'email' };

	let searchTimer: ReturnType<typeof setTimeout> | undefined;

	const fields = $derived(
		[...new Set(table.submissions.flatMap((submission) => Object.keys(submission.data)))].sort((a, b) => {
			if (a === 'email') return -1;
			if (b === 'email') return 1;
			return a.localeCompare(b);
		})
	);
	const sortLabel = $derived(sort.key === 'created_at' ? 'Time' : 'Email');
	const previousPage = $derived(table.page > 1 ? pageHref(table.page - 1) : undefined);
	const nextPage = $derived(table.page < table.pageCount ? pageHref(table.page + 1) : undefined);

	function text(value: unknown) {
		return value === undefined || value === null ? '' : String(value);
	}

	function heading(field: string) {
		return field.charAt(0).toUpperCase() + field.slice(1);
	}

	function href(changes: Record<string, string | null>) {
		const url = new URL(page.url.href);
		for (const [name, value] of Object.entries(changes)) {
			if (value === null) url.searchParams.delete(name);
			else url.searchParams.set(name, value);
		}
		return url.pathname + url.search;
	}

	function pageHref(target: number) {
		return href({ page: target === 1 ? null : String(target) });
	}

	function sortParam(key: SortKey, direction: Direction) {
		return `${direction === 'descending' ? '-' : ''}${SORT_PARAMS[key]}`;
	}

	function sortHref(key: SortKey) {
		const direction = sort.key === key && sort.direction === 'ascending' ? 'descending' : 'ascending';
		return href({ sort: sortParam(key, direction), page: null });
	}

	function search(event: Event & { currentTarget: HTMLFormElement }) {
		const form = event.currentTarget;
		clearTimeout(searchTimer);
		searchTimer = setTimeout(() => form.requestSubmit(), 250);
	}
</script>

{#snippet sortableHead(key: SortKey, label: string)}
	<Table.Head aria-sort={sort.key === key ? sort.direction : undefined} class="px-0">
		<Button variant="ghost" href={sortHref(key)}>
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

<div class="min-w-0 space-y-2" data-sveltekit-reset="false">
	<div class="flex items-center justify-between gap-2">
		<form
			method="GET"
			role="search"
			class="w-full max-w-sm"
			data-sveltekit-replacestate
			oninput={search}
		>
			<Input type="search" name="q" defaultValue={query} placeholder="Search submissions..." aria-label="Search submissions" />
			{#if sort.key !== 'created_at' || sort.direction !== 'descending'}
				<input type="hidden" name="sort" value={sortParam(sort.key, sort.direction)} />
			{/if}
		</form>
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
				{#each table.submissions as submission (submission.id)}
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
							No matching submissions.
						</Table.Cell>
					</Table.Row>
				{/each}
			</Table.Body>
		</Table.Root>
	</div>
	<div class="flex items-center justify-between gap-2">
		<p class="text-sm text-muted-foreground">
			{query ? `${table.matching} of ${total} submission(s)` : `${total} total submission(s)`}
		</p>
		{#if table.pageCount > 1}
			<nav aria-label="Pagination" class="flex items-center gap-2">
				<span class="text-sm text-muted-foreground">Page {table.page} of {table.pageCount}</span>
				<Button variant="outline" size="sm" href={previousPage ?? '#'} disabled={!previousPage}>Previous</Button>
				<Button variant="outline" size="sm" href={nextPage ?? '#'} disabled={!nextPage}>Next</Button>
			</nav>
		{/if}
	</div>
	<p class="sr-only" role="status">Sorted by {sortLabel}, {sort.direction}</p>
</div>
