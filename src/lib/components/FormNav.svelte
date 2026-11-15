<script lang="ts">
	import { page } from '$app/state';
	import Database from '@lucide/svelte/icons/database';
	import Puzzle from '@lucide/svelte/icons/puzzle';
	import Settings from '@lucide/svelte/icons/settings';
	import * as Sidebar from '#lib/components/ui/sidebar/index.js';

	const formId = $derived(page.params.formId);
	const items = $derived([
		{ title: 'Submissions', url: `/forms/${formId}/submissions`, icon: Database, reload: true },
		{ title: 'Integration', url: `/forms/${formId}/integration`, icon: Puzzle, reload: false },
		{ title: 'Settings', url: `/forms/${formId}/settings`, icon: Settings, reload: false }
	]);
</script>

<Sidebar.Group>
	<Sidebar.GroupContent>
		<Sidebar.Menu>
			{#each items as item (item.title)}
				<Sidebar.MenuItem>
					<Sidebar.MenuButton>
						{#snippet child({ props })}
							<a
								{...props}
								href={item.url}
								aria-current={page.url.pathname === item.url ? 'page' : undefined}
								data-sveltekit-reload={item.reload || undefined}
							>
								<item.icon />
								<span>{item.title}</span>
							</a>
						{/snippet}
					</Sidebar.MenuButton>
				</Sidebar.MenuItem>
			{/each}
		</Sidebar.Menu>
	</Sidebar.GroupContent>
</Sidebar.Group>
