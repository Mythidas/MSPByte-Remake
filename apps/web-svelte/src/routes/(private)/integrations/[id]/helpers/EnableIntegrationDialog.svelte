<script lang="ts">
	import {
		AlertDialog,
		AlertDialogAction,
		AlertDialogCancel,
		AlertDialogContent,
		AlertDialogDescription,
		AlertDialogFooter,
		AlertDialogHeader,
		AlertDialogTitle
	} from '$lib/components/ui/alert-dialog';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import Label from '$lib/components/ui/label/label.svelte';
	import { getIntegrationState } from './state.svelte.js';

	const integrationState = getIntegrationState();
	let understood = $state(false);

	function handleConfirm() {
		integrationState.confirmEnable();
		understood = false; // Reset for next time
	}

	function handleCancel() {
		integrationState.cancelDialog();
		understood = false; // Reset for next time
	}
</script>

<AlertDialog bind:open={integrationState.showEnableDialog}>
	<AlertDialogContent>
		<AlertDialogHeader>
			<AlertDialogTitle class="flex items-center gap-2">
				<span class="text-yellow-600">⚠️</span>
				Enable {integrationState.integration?.name} Integration
			</AlertDialogTitle>
			<AlertDialogDescription class="space-y-3 pt-2">
				<p>
					This will enable the <strong>{integrationState.integration?.name}</strong> integration for
					your organization.
				</p>
				<p class="text-foreground">
					<strong>Important:</strong> You will not be billed until you have completed the integration
					configuration. Once configured, billing will begin based on your usage.
				</p>
				<div class="mt-4 flex items-start gap-3 rounded-md border p-3">
					<Checkbox id="understand-enable" bind:checked={understood} class="bg-card" />
					<Label
						for="understand-enable"
						class="cursor-pointer text-sm leading-tight font-normal text-foreground"
					>
						I understand that billing will start after configuration is complete
					</Label>
				</div>
			</AlertDialogDescription>
		</AlertDialogHeader>
		<AlertDialogFooter>
			<AlertDialogCancel onclick={handleCancel}>Cancel</AlertDialogCancel>
			<AlertDialogAction
				onclick={handleConfirm}
				disabled={!understood}
				class="bg-yellow-600 hover:bg-yellow-700"
			>
				Enable Integration
			</AlertDialogAction>
		</AlertDialogFooter>
	</AlertDialogContent>
</AlertDialog>
