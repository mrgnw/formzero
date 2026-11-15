<script lang="ts">
	import LogOut from '@lucide/svelte/icons/log-out';
	import MoreHorizontal from '@lucide/svelte/icons/ellipsis';
	import Settings from '@lucide/svelte/icons/settings';
	import { signOut } from '#lib/auth.remote.js';
	import * as DropdownMenu from '#lib/components/ui/dropdown-menu/index.js';
	import * as Sidebar from '#lib/components/ui/sidebar/index.js';
	import NotificationSettingsDialog from '#lib/components/NotificationSettingsDialog.svelte';

	let { user }: { user: { name: string; email: string } } = $props();

	let signOutForm = $state<HTMLFormElement>();
	let settingsOpen = $state(false);
	const initial = $derived(user.name.charAt(0).toUpperCase());
</script>

<form {...signOut} bind:this={signOutForm} hidden></form>

<Sidebar.Menu>
	<Sidebar.MenuItem>
		<DropdownMenu.Root>
			<DropdownMenu.Trigger>
				{#snippet child({ props })}
					<Sidebar.MenuButton {...props} size="lg">
						<div
							class="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary font-semibold text-sidebar-primary-foreground"
						>
							{initial}
						</div>
						<div class="grid flex-1 text-left text-sm leading-tight">
							<span class="truncate font-semibold">{user.name}</span>
							<span class="truncate text-xs text-muted-foreground">{user.email}</span>
						</div>
						<MoreHorizontal class="ml-auto size-4" />
					</Sidebar.MenuButton>
				{/snippet}
			</DropdownMenu.Trigger>
			<DropdownMenu.Content class="w-auto min-w-56 rounded-lg" side="bottom" align="end" sideOffset={4}>
				<DropdownMenu.Item onSelect={() => (settingsOpen = true)}>
					<Settings />
					Settings
				</DropdownMenu.Item>
				<DropdownMenu.Item onSelect={() => signOutForm?.requestSubmit()}>
					<LogOut />
					Log out
				</DropdownMenu.Item>
			</DropdownMenu.Content>
		</DropdownMenu.Root>
	</Sidebar.MenuItem>
</Sidebar.Menu>

<NotificationSettingsDialog bind:open={settingsOpen} />
