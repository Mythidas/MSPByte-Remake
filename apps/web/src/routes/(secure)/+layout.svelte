<script lang="ts">
	import {
		Binary,
		LayoutDashboard,
		Users,
		Shield,
		Settings,
		Building,
		Bolt,
		Earth,
		ArrowBigRight,
		HatGlasses,
		TriangleAlert
	} from 'lucide-svelte';
	import Navbar from '$lib/components/nav/Navbar.svelte';
	import NavLink from '$lib/components/nav/NavLink.svelte';
	import NavGroup from '$lib/components/nav/NavGroup.svelte';
	import { setAppState } from '$lib/state/Application.svelte.js';

	let { children, data } = $props();

	const appState = setAppState({
		user: data.user,
		site: data.site,
		siteLinkedIntegrations: data.site?.linkedIntegrations
	});
</script>

<div class="flex size-full">
	<div class="flex h-full w-2/12 min-w-48 flex-col justify-between py-2 pl-2">
		<!--Content-->
		<div class="flex h-full flex-col gap-2">
			<!--Header-->
			<div class="flex items-center gap-2 p-2 text-2xl font-semibold">
				<Binary class="rounded border" />
				<span>MSPByte</span>
			</div>

			<hr class="hr" />

			<!--Nav-->
			<Navbar>
				<NavLink href="/home" label="Dashboard" exact icon={LayoutDashboard} />
				<NavLink href="/alerts" label="Alerts" params="view=active" exact icon={TriangleAlert} />

				{#if appState.getSite()}
					{@const site = appState.getSite()!}
					<NavGroup name="Sites" icon={Building}>
						<NavLink href="/sites" label="All Sites" exact icon={Earth} />
						<NavLink href={`/sites/${site.slug}`} label={site.name!} icon={ArrowBigRight} exact />
						<NavLink
							href={`/sites/${site.slug}/alerts`}
							params="view=active"
							label="Alerts"
							icon={TriangleAlert}
						/>
						{#if data.mspagent && data.mspagent.config.psaIntegrationId === site.psaIntegrationId}
							<NavLink
								href={`/sites/${site.slug}/integrations/msp-agent`}
								label="MSP Agent"
								icon={HatGlasses}
							/>
						{/if}

						{#if (appState.siteLinkedIntegrations && appState.siteLinkedIntegrations.length! > 0) || site.psaIntegrationId}
							<NavGroup name="Integrations" icon={Bolt}>
								{#if site.psaIntegrationId && site.psaIntegrationSlug}
									<NavLink
										href={`/sites/${site.slug}/integrations/${site.psaIntegrationSlug}`}
										label={site.psaIntegrationName || site.psaIntegrationSlug}
									/>
								{/if}

								{#each appState.siteLinkedIntegrations || [] as { slug, name }}
									<NavLink href={`/sites/${site.slug}/integrations/${slug}`} label={name} />
								{/each}
							</NavGroup>
						{/if}
					</NavGroup>
				{:else}
					<NavLink href="/sites" label="Sites" icon={Building} />
				{/if}

				<NavGroup name="Admin" icon={Settings}>
					<NavLink href="/users" label="Users" icon={Users} />
					<NavLink href="/roles" label="Roles" icon={Shield} />
					<NavLink href="/integrations" label="Integrations" icon={Bolt} />
				</NavGroup>
			</Navbar>
		</div>

		<!--Footer-->
		<div class="flex h-fit flex-col items-center gap-2">
			<span class="text-sm">[v0.0.1]</span>
		</div>
	</div>

	<!-- Main content -->
	<main class="flex size-full flex-col p-2">
		<div class="bg-card/70 flex size-full flex-col overflow-hidden rounded p-4 shadow">
			{@render children?.()}
		</div>
	</main>
</div>
