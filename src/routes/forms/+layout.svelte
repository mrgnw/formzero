<script lang="ts">
	import AppSidebar from '#lib/components/AppSidebar.svelte';
	import * as Sidebar from '#lib/components/ui/sidebar/index.js';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();
</script>

<Sidebar.Provider open={data.sidebarOpen}>
	<AppSidebar forms={data.forms} user={data.user} />
	<Sidebar.Inset class="min-w-0">
		{@render children()}
	</Sidebar.Inset>
</Sidebar.Provider>
