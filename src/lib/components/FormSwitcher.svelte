<script lang="ts">
	import { page } from '$app/state';
	import ChevronsUpDown from '@lucide/svelte/icons/chevrons-up-down';
	import Plus from '@lucide/svelte/icons/plus';
	import CreateFormDialog from '#lib/components/CreateFormDialog.svelte';
	import * as DropdownMenu from '#lib/components/ui/dropdown-menu/index.js';
	import * as Sidebar from '#lib/components/ui/sidebar/index.js';
	import type { FormSummary } from '#lib/server/forms.js';

	let { forms }: { forms: FormSummary[] } = $props();

	const sidebar = Sidebar.useSidebar();
	let dialogOpen = $state(false);
	const activeForm = $derived(forms.find((form) => form.id === page.params.formId) ?? forms[0]);
</script>

<Sidebar.Menu>
	<Sidebar.MenuItem>
		<DropdownMenu.Root>
			<DropdownMenu.Trigger>
				{#snippet child({ props })}
					<Sidebar.MenuButton
						{...props}
						size="lg"
						class="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
					>
						<img src="/favicon.svg" alt="" class="size-8 rounded-lg" />
						<div class="grid flex-1 text-left text-sm leading-tight">
							<span class="truncate font-medium">{activeForm.name}</span>
							<span class="truncate text-xs">{activeForm.id}</span>
						</div>
						<ChevronsUpDown class="ml-auto" />
					</Sidebar.MenuButton>
				{/snippet}
			</DropdownMenu.Trigger>
			<DropdownMenu.Content
				class="w-auto min-w-56 rounded-lg"
				align="start"
				side={sidebar.isMobile ? 'bottom' : 'right'}
				sideOffset={4}
			>
				<DropdownMenu.Label class="text-xs text-muted-foreground">Forms</DropdownMenu.Label>
				{#each forms as form (form.id)}
					<DropdownMenu.Item class="gap-2 p-2">
						{#snippet child({ props })}
							<a {...props} href="/forms/{form.id}/submissions" data-sveltekit-reload>
								<img src="/favicon.svg" alt="" class="size-6 shrink-0 rounded-md" />
								{form.name}
							</a>
						{/snippet}
					</DropdownMenu.Item>
				{/each}
				<DropdownMenu.Separator />
				<DropdownMenu.Item class="gap-2 p-2" onSelect={() => (dialogOpen = true)}>
					<div class="flex size-6 items-center justify-center rounded-md border bg-transparent">
						<Plus class="size-4" />
					</div>
					<div class="font-medium text-muted-foreground">Add form</div>
				</DropdownMenu.Item>
			</DropdownMenu.Content>
		</DropdownMenu.Root>
	</Sidebar.MenuItem>
</Sidebar.Menu>

<CreateFormDialog bind:open={dialogOpen} />
