<script lang="ts">
	import { page } from '$app/state';
	import * as Breadcrumb from '#lib/components/ui/breadcrumb/index.js';
	import { Separator } from '#lib/components/ui/separator/index.js';
	import * as Sidebar from '#lib/components/ui/sidebar/index.js';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	const section = $derived(page.route.id?.split('/').at(-1) ?? '');
	const pageTitle = $derived(section.charAt(0).toUpperCase() + section.slice(1));
</script>

<header class="flex h-16 shrink-0 items-center gap-2">
	<div class="flex items-center gap-2 px-4">
		<Sidebar.Trigger class="-ml-1" />
		<Separator orientation="vertical" class="mr-2 data-vertical:h-4 data-vertical:self-auto" />
		<Breadcrumb.Root>
			<Breadcrumb.List>
				<Breadcrumb.Item class="hidden md:block">
					<Breadcrumb.Link href="/" data-sveltekit-reload>FormZero</Breadcrumb.Link>
				</Breadcrumb.Item>
				<Breadcrumb.Separator class="hidden md:block" />
				<Breadcrumb.Item class="hidden md:block">
					<Breadcrumb.Link href="/forms/{data.form.id}/submissions" data-sveltekit-reload>
						{data.form.name}
					</Breadcrumb.Link>
				</Breadcrumb.Item>
				<Breadcrumb.Separator class="hidden md:block" />
				<Breadcrumb.Item>
					<Breadcrumb.Page>{pageTitle}</Breadcrumb.Page>
				</Breadcrumb.Item>
			</Breadcrumb.List>
		</Breadcrumb.Root>
	</div>
</header>
<div class="flex min-w-0 flex-1 flex-col gap-4 p-4 pt-0">
	{@render children()}
</div>
