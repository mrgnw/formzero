<script lang="ts">
	import { createForm } from '#lib/forms.remote.js';
	import { createFormSchema } from '#lib/schemas.js';
	import FieldIssues from '#lib/components/FieldIssues.svelte';
	import SubmitButton from '#lib/components/SubmitButton.svelte';
	import { Button } from '#lib/components/ui/button/index.js';
	import * as Dialog from '#lib/components/ui/dialog/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';

	let { open = $bindable(false) }: { open?: boolean } = $props();

	const { name } = createForm.fields;
</script>

<Dialog.Root bind:open>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>Create New Form</Dialog.Title>
			<Dialog.Description>Create a new form to start collecting submissions.</Dialog.Description>
		</Dialog.Header>
		<form
			{...createForm.preflight(createFormSchema).enhance(async ({ submit }) => {
				if (await submit()) open = false;
			})}
		>
			<div class="grid gap-4 py-4">
				<div class="grid gap-2">
					<Label for="create-form-name">Form Name</Label>
					<Input
						id="create-form-name"
						{...name.as('text')}
						aria-describedby={name.issues() ? 'create-form-name-issues' : undefined}
						placeholder="Contact Form"
						required
					/>
					<FieldIssues id="create-form-name-issues" issues={name.issues()} />
				</div>
			</div>
			<Dialog.Footer>
				<Button type="button" variant="outline" onclick={() => (open = false)}>Cancel</Button>
				<SubmitButton pending={createForm.pending > 0} pendingLabel="Creating...">Create Form</SubmitButton>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
