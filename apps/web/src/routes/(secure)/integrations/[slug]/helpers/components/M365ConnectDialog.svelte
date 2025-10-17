<script lang="ts">
	import SubmitButton from '$lib/components/SubmitButton.svelte';
	import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
	import { FieldErrors, FormControl, FormField, FormLabel } from '$lib/components/ui/form';
	import Input from '$lib/components/ui/input/input.svelte';
	import { defaults, superForm } from 'sveltekit-superforms';
	import { zod4 } from 'sveltekit-superforms/adapters';
	import { m365ConnectionSchema } from '../integration/schemas.js';
	import { Plus } from 'lucide-svelte';
	import { buttonVariants } from '$lib/components/ui/button/button.svelte';
	import { goto } from '$app/navigation';
	import { PUBLIC_MICROSOFT_CLIENT_ID, PUBLIC_ORIGIN } from '$env/static/public';
	import type { M365ConsentCallback } from '$lib/types/callbacks.js';
	import { getAppState } from '$lib/state/Application.svelte.js';

	const appState = getAppState();
	let isSubmitting = $state(false);

	const form = superForm(defaults(zod4(m365ConnectionSchema)), {
		validators: zod4(m365ConnectionSchema),
		onSubmit: async ({ formData, cancel }) => {
			isSubmitting = true;

			// Prevent the default action POST
			cancel();

			const params = new URLSearchParams({
				client_id: PUBLIC_MICROSOFT_CLIENT_ID,
				redirect_uri: `${PUBLIC_ORIGIN}/api/v1.0/callbacks/microsoft-365/consent`,
				state: JSON.stringify({
					action: 'initial',
					tenantId: appState.user.tenantId,
					name: formData.get('name'),
					timestamp: Date.now()
				} as M365ConsentCallback)
			});

			window.location.href = `https://login.microsoftonline.com/common/adminconsent?${params.toString()}`;
		},
		onResult: () => {
			isSubmitting = false;
		}
	});
	const { form: formData, enhance } = form;
</script>

<AlertDialog.Root
	onOpenChangeComplete={(val) => {
		if (!val) {
			form.reset();
			isSubmitting = false;
		}
	}}
>
	<AlertDialog.Trigger class={buttonVariants({ variant: 'default' })}>
		<Plus /> Create Connection
	</AlertDialog.Trigger>
	<AlertDialog.Content>
		<form method="POST" use:enhance class="space-y-4">
			<AlertDialog.Header>
				<AlertDialog.Title>Create M365 Connection</AlertDialog.Title>
				<AlertDialog.Description>
					Microsoft 365 Connections define a Entra Tenant. You will be directed to provide admin
					consent before creating the connection.
				</AlertDialog.Description>
			</AlertDialog.Header>

			<FormField {form} name="name">
				<FormControl>
					{#snippet children({ props })}
						<FormLabel>Connection Name</FormLabel>
						<Input placeholder="Enter connection name" {...props} bind:value={$formData.name} />
					{/snippet}
				</FormControl>
				<FieldErrors />
			</FormField>

			<AlertDialog.Footer>
				<AlertDialog.Cancel type="button">Cancel</AlertDialog.Cancel>
				<SubmitButton isLoading={isSubmitting}>Create Connection</SubmitButton>
			</AlertDialog.Footer>
		</form>
	</AlertDialog.Content>
</AlertDialog.Root>
