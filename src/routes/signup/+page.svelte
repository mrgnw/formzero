<script lang="ts">
	import { signUp } from '#lib/auth.remote.js';
	import { signUpSchema } from '#lib/schemas.js';
	import AuthCard from '#lib/components/AuthCard.svelte';
	import FieldIssues from '#lib/components/FieldIssues.svelte';
	import FormIssues from '#lib/components/FormIssues.svelte';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';

	const { name, email, _password, _confirmPassword } = signUp.fields;
</script>

<svelte:head>
	<title>Sign Up | FormZero</title>
	<meta name="description" content="Create your FormZero account" />
</svelte:head>

<AuthCard title="Welcome to FormZero" description="Create your account to get started">
	<form {...signUp.preflight(signUpSchema)} class="space-y-6">
		<div class="space-y-4">
			<div class="space-y-2">
				<Label for="name">Name</Label>
				<Input
					id="name"
					{...name.as('text')}
					aria-describedby={name.issues() ? 'name-issues' : undefined}
					required
					placeholder="Your name"
					autocomplete="name"
				/>
				<FieldIssues id="name-issues" issues={name.issues()} />
			</div>
			<div class="space-y-2">
				<Label for="email">Email</Label>
				<Input
					id="email"
					{...email.as('email')}
					aria-describedby={email.issues() ? 'email-issues' : undefined}
					required
					placeholder="you@example.com"
					autocomplete="email"
				/>
				<FieldIssues id="email-issues" issues={email.issues()} />
			</div>
			<div class="space-y-2">
				<Label for="password">Password</Label>
				<Input
					id="password"
					{..._password.as('password')}
					aria-describedby={_password.issues() ? 'password-issues' : undefined}
					required
					minlength={8}
					placeholder="At least 8 characters"
					autocomplete="new-password"
				/>
				<FieldIssues id="password-issues" issues={_password.issues()} />
			</div>
			<div class="space-y-2">
				<Label for="confirmPassword">Confirm Password</Label>
				<Input
					id="confirmPassword"
					{..._confirmPassword.as('password')}
					aria-describedby={_confirmPassword.issues() ? 'confirm-password-issues' : undefined}
					required
					minlength={8}
					placeholder="Re-enter your password"
					autocomplete="new-password"
				/>
				<FieldIssues id="confirm-password-issues" issues={_confirmPassword.issues()} />
			</div>
		</div>

		<div class="rounded-md bg-muted p-3 text-sm text-muted-foreground">
			<strong>Important:</strong> Please remember your password. Password recovery is not available yet.
		</div>

		<FormIssues issues={signUp.fields.allIssues()} />

		<Button type="submit" class="w-full" disabled={signUp.pending > 0}>
			{signUp.pending > 0 ? 'Creating Account...' : 'Create Account'}
		</Button>
	</form>
</AuthCard>
