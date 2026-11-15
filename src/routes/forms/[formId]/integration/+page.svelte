<script lang="ts">
	import { page } from '$app/state';
	import CircleHelp from '@lucide/svelte/icons/circle-question-mark';
	import CodeBlock from '#lib/components/CodeBlock.svelte';
	import CopyButton from '#lib/components/CopyButton.svelte';
	import * as Card from '#lib/components/ui/card/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import * as Tabs from '#lib/components/ui/tabs/index.js';
	import * as Tooltip from '#lib/components/ui/tooltip/index.js';
	import { snippets } from '#lib/snippets.js';

	let redirectUrl = $state('');

	const formEndpoint = $derived(`${page.url.origin}/api/forms/${page.params.formId}/submissions`);
	const code = $derived(snippets(formEndpoint, redirectUrl));
</script>

<svelte:head>
	<title>Integration | FormZero</title>
	<meta name="description" content="Integrate your form with HTML, JavaScript, React, Svelte, or SvelteKit" />
</svelte:head>

{#snippet inlineCode(text: string)}
	<code class="rounded bg-muted px-1 py-0.5 text-xs">{text}</code>
{/snippet}

<div class="flex flex-1 flex-col gap-3">
	<Card.Root>
		<Card.Header>
			<Card.Title>Endpoint</Card.Title>
			<Card.Description>
				Use this as your HTML form {@render inlineCode('action')} URL or just send JSON to it.
			</Card.Description>
		</Card.Header>
		<Card.Content>
			<div class="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
				<code class="flex-1 rounded-md bg-muted px-3 py-2 font-mono text-xs break-all">{formEndpoint}</code>
				<CopyButton
					text={formEndpoint}
					label="Copy Endpoint"
					labelClass="sm:sr-only"
					variant="outline"
					size="sm"
					class="w-full shrink-0 sm:w-auto sm:px-3 [&_svg]:size-3.5"
				/>
			</div>
		</Card.Content>
	</Card.Root>

	<Card.Root>
		<Card.Header>
			<Card.Title>Integration Examples</Card.Title>
			<Card.Description>Choose your preferred method to submit data to your form.</Card.Description>
		</Card.Header>
		<Card.Content>
			<Tabs.Root value="html" class="w-full">
				<Tabs.List>
					<Tabs.Trigger value="html">HTML</Tabs.Trigger>
					<Tabs.Trigger value="javascript">JavaScript</Tabs.Trigger>
					<Tabs.Trigger value="react">React</Tabs.Trigger>
					<Tabs.Trigger value="svelte">Svelte</Tabs.Trigger>
					<Tabs.Trigger value="sveltekit">SvelteKit</Tabs.Trigger>
				</Tabs.List>

				<Tabs.Content value="html" class="mt-3 space-y-3">
					<div class="space-y-2">
						<div class="flex items-center gap-1.5">
							<Label for="redirect-url">Redirect URL (optional)</Label>
							<Tooltip.Provider delayDuration={150}>
								<Tooltip.Root>
									<Tooltip.Trigger
										aria-label="How this works"
										class="text-muted-foreground hover:text-foreground"
									>
										<CircleHelp class="size-3.5" />
									</Tooltip.Trigger>
									<Tooltip.Content class="max-w-xs">
										<p>
											We append <code>?redirect=</code> to the form's action URL in the snippet below. It's a
											copy-and-paste helper - nothing is saved on your form.
										</p>
									</Tooltip.Content>
								</Tooltip.Root>
							</Tooltip.Provider>
						</div>
						<Input
							id="redirect-url"
							type="url"
							bind:value={redirectUrl}
							placeholder="https://yoursite.com/thanks.html"
						/>
						<p class="text-xs text-muted-foreground">
							After submission, users are redirected here. Leave empty to send them back to the page they came
							from.
						</p>
					</div>
					<CodeBlock code={code.html} language="markup" label="Copy HTML form" />
				</Tabs.Content>

				<Tabs.Content value="javascript" class="mt-3">
					<CodeBlock code={code.js} language="javascript" label="Copy JavaScript example" />
				</Tabs.Content>

				<Tabs.Content value="react" class="mt-3">
					<CodeBlock code={code.react} language="jsx" label="Copy React example" />
				</Tabs.Content>

				<Tabs.Content value="svelte" class="mt-3 space-y-4">
					<div class="space-y-2">
						<h3 class="text-sm font-medium">Plain form</h3>
						<p class="text-xs text-muted-foreground">
							The HTML form is a valid {@render inlineCode('.svelte')} file as is. It does a full-page POST and uses
							the redirect URL from the HTML tab.
						</p>
						<CodeBlock code={code.html} language="markup" label="Copy plain Svelte form" />
					</div>
					<div class="space-y-2">
						<h3 class="text-sm font-medium">Svelte 5 with fetch</h3>
						<p class="text-xs text-muted-foreground">
							Submits JSON without leaving the page and tracks status with {@render inlineCode('$state')}.
						</p>
						<CodeBlock code={code.svelteFetch} language="markup" label="Copy Svelte fetch example" />
					</div>
				</Tabs.Content>

				<Tabs.Content value="sveltekit" class="mt-3 space-y-4">
					<div class="space-y-2">
						<h3 class="text-sm font-medium">Remote function (experimental)</h3>
						<p class="text-xs text-muted-foreground">
							The server forwards the submission, so the browser never makes a cross-origin request. Needs {@render inlineCode(
								'kit.experimental.remoteFunctions'
							)} and {@render inlineCode('compilerOptions.experimental.async')} in {@render inlineCode(
								'svelte.config.js'
							)}, plus {@render inlineCode('valibot')}.
						</p>
						<CodeBlock code={code.svelteRemote} language="typescript" label="Copy remote function" />
						<CodeBlock code={code.svelteRemoteComponent} language="markup" label="Copy component" />
					</div>
				</Tabs.Content>
			</Tabs.Root>
		</Card.Content>
	</Card.Root>
</div>
