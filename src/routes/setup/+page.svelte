<script lang="ts">
	import { createForm } from '#lib/forms.remote.js';
	import { createFormSchema } from '#lib/schemas.js';
	import AuthCard from '#lib/components/AuthCard.svelte';
	import FormIssues from '#lib/components/FormIssues.svelte';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';

	const { name } = createForm.fields;
</script>

<svelte:head>
	<title>Create Your First Form | FormZero</title>
	<meta name="description" content="Create your first form to start collecting submissions" />
</svelte:head>

<AuthCard title="Create Your First Form" description="Start collecting submissions in seconds">
	<form {...createForm.preflight(createFormSchema)} class="space-y-6">
		<div class="space-y-4">
			<div class="space-y-2">
				<Label for="name">Form Name</Label>
				<Input id="name" {...name.as('text')} required placeholder="Contact Form" autofocus />
			</div>
		</div>

		<FormIssues issues={createForm.fields.allIssues()} />

		<Button type="submit" class="w-full" disabled={createForm.pending > 0}>
			{createForm.pending > 0 ? 'Creating...' : 'Create Form'}
		</Button>
	</form>
</AuthCard>
