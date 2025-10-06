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

	// Calculate the deletion date (7 days from now)
	const deletionDate = $derived(() => {
		const date = new Date();
		date.setDate(date.getDate() + 7);
		return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
	});

	function handleConfirm() {
		integrationState.confirmDisable();
		understood = false; // Reset for next time
	}

	function handleCancel() {
		integrationState.cancelDialog();
		understood = false; // Reset for next time
	}
</script>

<AlertDialog bind:open={integrationState.showDisableDialog}>
	<AlertDialogContent>
		<AlertDialogHeader>
			<AlertDialogTitle class="flex items-center gap-2">
				<span class="text-red-600">⚠️</span>
				Disable {integrationState.integration?.name} Integration
			</AlertDialogTitle>
			<AlertDialogDescription class="space-y-3 pt-2">
				<p class="text-foreground">
					<strong>Warning:</strong> Disabling this integration will have the following consequences:
				</p>
				<ul class="ml-5 list-disc space-y-2 text-foreground">
					<li>
						All integration data will be <strong>staged for deletion</strong>
					</li>
					<li>
						Data will be <strong>permanently deleted</strong> on
						<strong class="text-red-600">{deletionDate()}</strong> (7 days from now)
					</li>
					<li>
						If the integration remains disabled during the next billing cycle, you will
						<strong>still be billed</strong> for the current period
					</li>
					<li>All data will be <strong>lost permanently</strong> after the 7-day grace period</li>
				</ul>
				<div class="borderp-3 mt-4 flex items-start gap-3 rounded-md border p-1">
					<Checkbox id="understand-disable" bind:checked={understood} class="mt-0.5" />
					<Label
						for="understand-disable"
						class="cursor-pointer text-sm leading-tight font-normal text-foreground"
					>
						I understand that all data will be permanently deleted after 7 days and I may still be
						billed for the current period
					</Label>
				</div>
			</AlertDialogDescription>
		</AlertDialogHeader>
		<AlertDialogFooter>
			<AlertDialogCancel onclick={handleCancel}>Cancel</AlertDialogCancel>
			<AlertDialogAction
				onclick={handleConfirm}
				disabled={!understood}
				class="bg-red-600 hover:bg-red-700"
			>
				Disable Integration
			</AlertDialogAction>
		</AlertDialogFooter>
	</AlertDialogContent>
</AlertDialog>
