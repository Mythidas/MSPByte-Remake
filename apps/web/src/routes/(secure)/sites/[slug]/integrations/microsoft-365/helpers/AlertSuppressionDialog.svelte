<script lang="ts">
	import { api, type Doc } from '$lib/convex';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { getAppState } from '$lib/state/Application.svelte.js';
	import { toast } from 'svelte-sonner';

	let {
		alert,
		open = $bindable(false),
		onSuccess
	}: {
		alert: Doc<'entity_alerts'>;
		open?: boolean;
		onSuccess?: () => void;
	} = $props();

	const appState = getAppState();

	let reason = $state('');
	let suppressUntilDate = $state('');
	let isSubmitting = $state(false);

	async function handleSubmit() {
		if (!reason.trim()) {
			toast.error('Please provide a reason for suppressing this alert');
			return;
		}

		isSubmitting = true;

		try {
			const suppressedUntil = suppressUntilDate ? new Date(suppressUntilDate).getTime() : undefined;

			await appState.convex.mutation(api.entity_alerts.mutations.suppressAlert, {
				alertId: alert._id,
				reason: reason.trim(),
				suppressedUntil
			});

			toast.success('Alert suppressed successfully');
			open = false;
			reason = '';
			suppressUntilDate = '';
			onSuccess?.();
		} catch (error) {
			console.error('Failed to suppress alert:', error);
			toast.error(
				`Failed to suppress alert: ${error instanceof Error ? error.message : 'Unknown error'}`
			);
		} finally {
			isSubmitting = false;
		}
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="sm:max-w-[500px]">
		<Dialog.Header>
			<Dialog.Title>Suppress Alert</Dialog.Title>
			<Dialog.Description>
				Provide a reason for suppressing this alert. You can optionally set an expiration date after
				which the alert will become active again.
			</Dialog.Description>
		</Dialog.Header>

		<form
			onsubmit={(e) => {
				e.preventDefault();
				handleSubmit();
			}}
			class="space-y-4"
		>
			<div class="space-y-2">
				<Label for="reason">Reason *</Label>
				<textarea
					id="reason"
					bind:value={reason}
					placeholder="e.g., User is a service account, expected to be inactive..."
					class="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex min-h-[100px] w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
					required
				></textarea>
			</div>

			<div class="space-y-2">
				<Label for="suppressUntil">Suppress Until (Optional)</Label>
				<Input
					id="suppressUntil"
					type="date"
					bind:value={suppressUntilDate}
					min={new Date().toISOString().split('T')[0]}
				/>
				<p class="text-muted-foreground text-sm">
					Leave empty to suppress indefinitely. The alert will automatically reactivate on this
					date.
				</p>
			</div>

			<Dialog.Footer>
				<Button
					type="button"
					variant="outline"
					onclick={() => {
						open = false;
					}}
					disabled={isSubmitting}
				>
					Cancel
				</Button>
				<Button type="submit" disabled={isSubmitting || !reason.trim()}>
					{isSubmitting ? 'Suppressing...' : 'Suppress Alert'}
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
