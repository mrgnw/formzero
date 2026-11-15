<script lang="ts">
	import { untrack } from 'svelte';
	import Lock from '@lucide/svelte/icons/lock';
	import Mail from '@lucide/svelte/icons/mail';
	import Server from '@lucide/svelte/icons/server';
	import { clearNotificationSettings, notificationSettings } from '#lib/settings.remote.js';
	import {
		SMTP_PROVIDERS,
		canKeepPassword,
		emailDomain,
		notificationSettingsSchema,
		type SavedNotificationSettings
	} from '#lib/smtp.js';
	import FieldIssues from '#lib/components/FieldIssues.svelte';
	import FormIssues from '#lib/components/FormIssues.svelte';
	import SubmitButton from '#lib/components/SubmitButton.svelte';
	import * as Card from '#lib/components/ui/card/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import * as Tooltip from '#lib/components/ui/tooltip/index.js';

	let {
		saved,
		justSaved,
		onsaved
	}: { saved: SavedNotificationSettings | null; justSaved: boolean; onsaved: () => void } = $props();

	const settingsForm = notificationSettings.for(untrack(() => String(saved?.updated_at ?? 'new')));
	const { intent, notification_email, _password, smtp_host, smtp_port } = settingsForm.fields;

	const email = $derived(notification_email.value() ?? saved?.notification_email ?? '');
	const domain = $derived(emailDomain(email));
	const provider = $derived(domain ? SMTP_PROVIDERS[domain] : undefined);
	const host = $derived(provider?.host ?? smtp_host.value() ?? saved?.smtp_host ?? '');
	const port = $derived(provider?.port ?? smtp_port.value() ?? saved?.smtp_port);
	const password = $derived(_password.value() ?? '');
	const keepsPassword = $derived(
		port !== undefined &&
			canKeepPassword(saved, { notification_email: email.trim(), smtp_host: host.trim(), smtp_port: port })
	);
	const key = $derived(JSON.stringify([email, password, host, port]));
	const canTest = $derived(Boolean(email && domain && (password || keepsPassword) && host && port));

	let testedKey = $state('');
	const testPassed = $derived(testedKey === key);
	let pendingIntent = $state<'test' | 'save' | null>(null);
	let testSent = $state(false);

	const enhanced = settingsForm.preflight(notificationSettingsSchema).enhance(async ({ submit, fields }) => {
		const submittedKey = key;
		const submittedIntent = fields.intent.value() ?? null;
		pendingIntent = submittedIntent;
		try {
			if (!(await submit())) return;
		} finally {
			pendingIntent = null;
		}
		if (submittedIntent === 'save') {
			onsaved();
			return;
		}
		testedKey = submittedKey;
		testSent = true;
		setTimeout(() => (testSent = false), 2000);
	});
</script>

<Card.Root class="w-full">
	<Card.Header>
		<Card.Title>Email Notifications</Card.Title>
		<Card.Description>Configure email notifications for all form submissions</Card.Description>
	</Card.Header>
	<Card.Content>
		<form {...enhanced} class="space-y-4">
			<div class="space-y-2">
				<Label for="notification-email" class="flex items-center gap-2">
					<Mail class="size-4" />
					Your Email
				</Label>
				<Input
					id="notification-email"
					{...notification_email.as('email', saved?.notification_email)}
					autocomplete="email"
					placeholder="your.email@example.com"
					aria-describedby="notification-email-help notification-email-issues"
					required
				/>
				<p id="notification-email-help" class="text-sm text-muted-foreground">
					This email will be used to send and receive notifications
				</p>
				<FieldIssues id="notification-email-issues" issues={notification_email.issues()} />
			</div>

			{#if domain}
				<div class="space-y-2">
					<Label for="smtp-password" class="flex items-center gap-2">
						<Lock class="size-4" />
						SMTP Password
					</Label>
					<Input
						id="smtp-password"
						{..._password.as('password')}
						autocomplete="new-password"
						placeholder={keepsPassword ? 'Leave blank to keep the saved password' : 'Enter your SMTP password'}
						aria-describedby="smtp-password-help smtp-password-issues"
						required={!keepsPassword}
					/>
					<p id="smtp-password-help" class="text-sm text-muted-foreground">
						{provider ? provider.hint : 'Use your email password or app-specific password'}
					</p>
					<FieldIssues id="smtp-password-issues" issues={_password.issues()} />
				</div>

				{#if provider}
					<input {...smtp_host.as('hidden', provider.host)} />
					<input {...smtp_port.as('hidden', provider.port)} />
				{:else}
					<div class="space-y-2">
						<Label for="smtp-host" class="flex items-center gap-2">
							<Server class="size-4" />
							SMTP Host
						</Label>
						<Input
							id="smtp-host"
							{...smtp_host.as('text', saved?.smtp_host)}
							placeholder="smtp.example.com"
							aria-describedby="smtp-host-help smtp-host-issues"
							required
						/>
						<p id="smtp-host-help" class="text-sm text-muted-foreground">
							The SMTP server address for your email provider
						</p>
						<FieldIssues id="smtp-host-issues" issues={smtp_host.issues()} />
					</div>
					<div class="space-y-2">
						<Label for="smtp-port">SMTP Port</Label>
						<Input
							id="smtp-port"
							{...smtp_port.as('number', saved?.smtp_port)}
							placeholder="587"
							min="1"
							max="65535"
							aria-describedby="smtp-port-help smtp-port-issues"
							required
						/>
						<p id="smtp-port-help" class="text-sm text-muted-foreground">
							Common ports: 587 (TLS), 465 (SSL), 25 (Plain)
						</p>
						<FieldIssues id="smtp-port-issues" issues={smtp_port.issues()} />
					</div>
				{/if}

				<div class="space-y-3 pt-4">
					<FormIssues issues={settingsForm.fields.allIssues()} />
					<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
						<div class="flex flex-col gap-2 sm:flex-row">
							<SubmitButton
								{...intent.as('submit', 'test')}
								variant="outline"
								class="w-full sm:w-auto"
								disabled={!canTest}
								pending={pendingIntent === 'test'}
								pendingLabel="Sending..."
								done={testSent}
								doneLabel="Test email sent!"
							>
								Send test email
							</SubmitButton>
							<Tooltip.Provider>
								<Tooltip.Root disabled={testPassed}>
									<Tooltip.Trigger>
										{#snippet child({ props })}
											<span {...props} class="w-full sm:w-auto">
												<SubmitButton
													{...intent.as('submit', 'save')}
													class="w-full sm:w-auto"
													disabled={!testPassed}
													aria-describedby="save-hint"
													pending={pendingIntent === 'save'}
													pendingLabel="Saving..."
													done={justSaved}
												>
													Save Settings
												</SubmitButton>
											</span>
										{/snippet}
									</Tooltip.Trigger>
									<Tooltip.Content>
										<p>Send a test email first to verify your settings</p>
									</Tooltip.Content>
								</Tooltip.Root>
							</Tooltip.Provider>
						</div>
						{#if saved}
							<SubmitButton
								form="clear-notification-settings"
								variant="outline"
								class="w-full text-destructive hover:text-destructive sm:w-auto"
								pending={clearNotificationSettings.pending > 0}
								pendingLabel="Disabling..."
							>
								Disable Notifications
							</SubmitButton>
						{/if}
					</div>
					{#if !testPassed}
						<p id="save-hint" class="text-sm text-muted-foreground">
							Send a test email first to verify your settings
						</p>
					{/if}
				</div>
			{/if}
		</form>
		<form id="clear-notification-settings" {...clearNotificationSettings} hidden></form>
	</Card.Content>
</Card.Root>
