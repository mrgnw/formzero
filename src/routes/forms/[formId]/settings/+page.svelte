<script lang="ts">
	import FieldIssues from '#lib/components/FieldIssues.svelte';
	import SubmitButton from '#lib/components/SubmitButton.svelte';
	import { Button } from '#lib/components/ui/button/index.js';
	import * as Card from '#lib/components/ui/card/index.js';
	import * as Dialog from '#lib/components/ui/dialog/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import { deleteForm, renameForm } from '#lib/form-settings.remote.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const rename = $derived(renameForm.for(data.form.id));
	const remove = $derived(deleteForm.for(data.form.id));

	let saved = $state(false);
	let deleteOpen = $state(false);
	let confirmText = $state('');

	const name = $derived((rename.fields.name.value() ?? data.form.name).trim());
	const canSave = $derived(name !== '' && name !== data.form.name);
	const deleting = $derived(remove.pending > 0);

	function openDelete() {
		confirmText = '';
		deleteOpen = true;
	}
</script>

<svelte:head>
	<title>Settings | FormZero</title>
	<meta name="description" content="Manage your form settings" />
</svelte:head>

<div class="flex min-w-0 max-w-2xl flex-1 flex-col gap-4">
	<Card.Root>
		<Card.Header>
			<Card.Title>Form Name</Card.Title>
			<Card.Description>
				Used in the dashboard and in email notifications. Changing the name does not change the form's URL.
			</Card.Description>
		</Card.Header>
		<Card.Content>
			<form
				class="space-y-4"
				{...rename.enhance(async ({ submit }) => {
					if (!(await submit())) return;
					saved = true;
					setTimeout(() => (saved = false), 2000);
				})}
			>
				<input {...rename.fields.id.as('hidden', data.form.id)} />
				<div class="space-y-2">
					<Label for="name">Name</Label>
					<Input
						id="name"
						{...rename.fields.name.as('text', data.form.name)}
						aria-describedby={rename.fields.name.issues() ? 'name-issues' : undefined}
						required
					/>
					<FieldIssues id="name-issues" issues={rename.fields.name.issues()} />
				</div>
				<SubmitButton pending={rename.pending > 0} done={saved} disabled={!canSave} pendingLabel="Saving...">
					Save
				</SubmitButton>
			</form>
		</Card.Content>
	</Card.Root>

	<Card.Root class="ring-destructive/50">
		<Card.Header>
			<Card.Title>Danger Zone</Card.Title>
			<Card.Description>
				Deleting this form permanently removes it and every submission it has received. This action cannot be undone.
			</Card.Description>
		</Card.Header>
		<Card.Content>
			<Button variant="destructive" class="self-start" onclick={openDelete}>Delete Form</Button>
		</Card.Content>
	</Card.Root>
</div>

<Dialog.Root bind:open={deleteOpen}>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>Delete “{data.form.name}”?</Dialog.Title>
			<Dialog.Description>
				This permanently removes the form and all of its submissions. Type the form name below to confirm.
			</Dialog.Description>
		</Dialog.Header>
		<form {...remove}>
			<input {...remove.fields.id.as('hidden', data.form.id)} />
			<div class="space-y-2 pb-4">
				<Label for="confirm">Form name</Label>
				<Input id="confirm" bind:value={confirmText} placeholder={data.form.name} autocomplete="off" />
			</div>
			<Dialog.Footer>
				<Button type="button" variant="outline" disabled={deleting} onclick={() => (deleteOpen = false)}>
					Cancel
				</Button>
				<SubmitButton variant="destructive" pending={deleting} disabled={confirmText !== data.form.name} pendingLabel="Deleting...">
					Delete Form
				</SubmitButton>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
