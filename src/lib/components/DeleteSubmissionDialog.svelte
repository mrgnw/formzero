<script lang="ts">
	import SubmitButton from '#lib/components/SubmitButton.svelte';
	import { Button } from '#lib/components/ui/button/index.js';
	import * as Dialog from '#lib/components/ui/dialog/index.js';
	import type { Submission } from '#lib/server/dashboard.js';
	import { deleteSubmission } from '#lib/submissions.remote.js';

	let { submission = $bindable(null) }: { submission: Pick<Submission, 'id' | 'form_id'> | null } = $props();

	const pending = $derived(deleteSubmission.pending > 0);

	function close() {
		if (!pending) submission = null;
	}
</script>

<Dialog.Root bind:open={() => submission !== null, (open) => !open && close()}>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>Delete submission?</Dialog.Title>
			<Dialog.Description>
				This permanently removes the submission and its data. This action cannot be undone.
			</Dialog.Description>
		</Dialog.Header>
		<form
			{...deleteSubmission.enhance(async ({ submit }) => {
				if (await submit()) submission = null;
			})}
		>
			<input {...deleteSubmission.fields.id.as('hidden', submission?.id ?? '')} />
			<input {...deleteSubmission.fields.form_id.as('hidden', submission?.form_id ?? '')} />
			<Dialog.Footer>
				<Button type="button" variant="outline" disabled={pending} onclick={close}>Cancel</Button>
				<SubmitButton variant="destructive" {pending} pendingLabel="Deleting...">Delete</SubmitButton>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
