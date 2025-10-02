<script lang="ts">
	import { faMicrosoft } from '@fortawesome/free-brands-svg-icons';
	import Fa from 'svelte-fa';
	import { enhance } from '$app/forms';

	let loading = $state(false);
</script>

<main class="flex size-full gap-4 p-4">
	<!--Graphic-->
	<section
		class="flex size-full flex-col justify-between rounded bg-linear-to-br from-primary-500/50 to-secondary-500/50 p-4 shadow"
	>
		<h1 class="text-4xl">MSP Byte</h1>
		<span class="text-4xl">"Byte sized view of your MSP"</span>
	</section>
	<!--Form-->
	<section class="flex size-full">
		<form
			method="POST"
			action="?/azure"
			use:enhance={() => {
				loading = true;
				return async ({ update }) => {
					await update();
					loading = false;
				};
			}}
			class="flex size-full items-center justify-center"
		>
			<div
				class="flex h-fit w-full flex-col gap-2 card rounded preset-filled-surface-100-900 p-4 text-center shadow"
			>
				<h1>- Social Logins -</h1>
				<hr class="hr" />
				<div class="flex w-full items-center justify-center">
					<button type="submit" class="btn p-2 hover:preset-tonal-primary" disabled={loading}>
						<Fa icon={faMicrosoft} size="lg" />
					</button>
				</div>
			</div>
		</form>
	</section>
</main>
