<script lang="ts">
	import { SignIn } from 'svelte-clerk';
</script>

<main class="flex size-full gap-4 p-4">
	<!--Graphic-->
	<section
		class="flex size-full flex-col justify-between rounded bg-linear-to-br from-primary/70 to-secondary/50 p-4 shadow"
	>
		<h1 class="text-4xl">MSP Byte</h1>
		<span class="text-4xl">Byte sized view of your MSP</span>
	</section>
	<!--Form-->
	<section class="flex size-full items-center justify-center">
		<SignIn />
	</section>
</main>
