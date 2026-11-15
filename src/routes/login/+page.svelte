<script lang="ts">
	import { signIn } from '#lib/auth.remote.js';
	import { signInSchema } from '#lib/schemas.js';
	import AuthCard from '#lib/components/AuthCard.svelte';
	import FormIssues from '#lib/components/FormIssues.svelte';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';

	const { email, _password } = signIn.fields;
</script>

<svelte:head>
	<title>Login | FormZero</title>
	<meta name="description" content="Sign in to your FormZero account" />
</svelte:head>

<AuthCard title="Welcome Back" description="Sign in to access your form backend">
	<form {...signIn.preflight(signInSchema)} class="space-y-6">
		<div class="space-y-4">
			<div class="space-y-2">
				<Label for="email">Email</Label>
				<Input id="email" {...email.as('email')} required placeholder="you@example.com" autocomplete="email" />
			</div>
			<div class="space-y-2">
				<Label for="password">Password</Label>
				<Input
					id="password"
					{..._password.as('password')}
					required
					placeholder="Your password"
					autocomplete="current-password"
				/>
			</div>
		</div>

		<FormIssues issues={signIn.fields.allIssues()} />

		<Button type="submit" class="w-full" disabled={signIn.pending > 0}>
			{signIn.pending > 0 ? 'Signing In...' : 'Sign In'}
		</Button>
	</form>
</AuthCard>
