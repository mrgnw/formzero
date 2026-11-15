<script lang="ts">
	import FormNav from '#lib/components/FormNav.svelte';
	import FormSwitcher from '#lib/components/FormSwitcher.svelte';
	import UserMenu from '#lib/components/UserMenu.svelte';
	import * as Sidebar from '#lib/components/ui/sidebar/index.js';
	import type { FormSummary } from '#lib/server/forms.js';

	let { forms, user }: { forms: FormSummary[]; user: { name: string; email: string } } = $props();
</script>

<Sidebar.Root collapsible="offcanvas">
	<Sidebar.Header>
		<FormSwitcher {forms} />
	</Sidebar.Header>
	<Sidebar.Content>
		<FormNav />
	</Sidebar.Content>
	<Sidebar.Footer>
		<UserMenu {user} />
	</Sidebar.Footer>
	<Sidebar.Rail />
</Sidebar.Root>
