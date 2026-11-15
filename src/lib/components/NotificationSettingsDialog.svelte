<script lang="ts">
	import { getNotificationSettings } from '#lib/settings.remote.js';
	import NotificationForm from '#lib/components/NotificationForm.svelte';
	import * as Dialog from '#lib/components/ui/dialog/index.js';

	let { open = $bindable(false) }: { open?: boolean } = $props();

	let justSaved = $state(false);

	function onsaved() {
		justSaved = true;
		setTimeout(() => (justSaved = false), 2000);
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="flex h-[90vh] max-h-[90vh] w-[90vw] max-w-[90vw] flex-col items-start overflow-y-auto p-6 sm:max-w-[90vw]">
		<Dialog.Header class="mb-6 w-full">
			<Dialog.Title>Settings</Dialog.Title>
		</Dialog.Header>
		{#if open}
			{@const settings = getNotificationSettings()}
			{#if settings.error}
				<p role="alert" class="text-sm text-destructive">Failed to load settings</p>
			{:else if settings.ready}
				{#key settings.current?.updated_at}
					<NotificationForm saved={settings.current} {justSaved} {onsaved} />
				{/key}
			{:else}
				<p class="text-sm text-muted-foreground">Loading settings...</p>
			{/if}
		{/if}
	</Dialog.Content>
</Dialog.Root>
