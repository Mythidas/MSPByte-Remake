<script lang="ts">
	import type { Doc } from '$lib/convex';
	import DataTable from '$lib/components/table/DataTable.svelte';
	import { type DataTableCell } from '$lib/components/table/types.js';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';
	import { type Firewall } from '@workspace/database/convex/types/normalized.js';
	import { type SophosPartnerFirewall } from '@workspace/shared/types/integrations/sophos-partner/firewall.js';
	import { CircleArrowUp } from 'lucide-svelte';

	interface Props {
		data: Doc<'entities'>[] | undefined;
		isLoading: boolean;
		filters: any;
	}

	let { data, isLoading, filters = $bindable() }: Props = $props();
</script>

{#snippet firewallStatusSnip({ row }: DataTableCell<Doc<'entities'>>)}
	{@const data = row.normalizedData as Firewall}
	{@const status = data.status || 'unknown'}
	{@const lastSeen = data.lastSeenAt ? new Date(data.lastSeenAt).toLocaleString() : 'Never'}
	<Tooltip.Provider>
		<Tooltip.Root>
			<Tooltip.Trigger>
				{#if status === 'online'}
					<div class="h-4 w-4 rounded-full bg-chart-1" title="Online"></div>
				{:else if status === 'offline'}
					<div class="h-4 w-4 rounded-full bg-destructive" title="Offline"></div>
				{:else}
					<div class="h-4 w-4 rounded-full bg-muted" title="Unknown"></div>
				{/if}
			</Tooltip.Trigger>
			<Tooltip.Content>
				<div class="flex flex-col gap-1">
					<div class="font-semibold capitalize">{status}</div>
					<div class="text-xs">Last seen: {lastSeen}</div>
				</div>
			</Tooltip.Content>
		</Tooltip.Root>
	</Tooltip.Provider>
{/snippet}

{#snippet firewallFirmwareSnip({ row }: DataTableCell<Doc<'entities'>>)}
	{@const rawData = row.rawData as SophosPartnerFirewall}
	{@const hasUpgrade =
		rawData.firmware?.upgradeToVersion && rawData.firmware.upgradeToVersion.length > 0}
	<span class="flex items-center gap-2">
		{rawData.firmwareVersion || 'Unknown'}
		{#if hasUpgrade}
			<Tooltip.Provider>
				<Tooltip.Root>
					<Tooltip.Trigger>
						<CircleArrowUp class="w-4 text-amber-500" />
					</Tooltip.Trigger>
					<Tooltip.Content>
						<div class="flex flex-col gap-1">
							{rawData.firmware?.upgradeToVersion[0]}
						</div>
					</Tooltip.Content>
				</Tooltip.Root>
			</Tooltip.Provider>
		{/if}
	</span>
{/snippet}

<DataTable
	rows={data || []}
	{isLoading}
	bind:filters
	columns={[
		{
			key: 'normalizedData.status',
			title: '',
			sortable: true,
			cell: firewallStatusSnip,
			width: '48px',
			filter: {
				label: 'Status',
				component: 'select',
				operators: ['eq', 'ne'],
				defaultOperator: 'eq',
				options: [
					{ label: 'Online', value: 'online' },
					{ label: 'Offline', value: 'offline' },
					{ label: 'Unknown', value: null }
				],
				placeholder: 'Select status'
			}
		},
		{
			key: 'normalizedData.hostname',
			title: 'Hostname',
			searchable: true,
			sortable: true,
			render: ({ row }) => (row.normalizedData as Firewall).hostname
		},
		{
			key: 'rawData.name',
			title: 'Name',
			searchable: true,
			sortable: true,
			render: ({ row }) => (row.rawData as SophosPartnerFirewall).name
		},
		{
			key: 'normalizedData.serial',
			title: 'Serial',
			searchable: true,
			sortable: true,
			render: ({ row }) => (row.normalizedData as Firewall).serial
		},
		{
			key: 'normalizedData.model',
			title: 'Firmware',
			sortable: true,
			searchable: true,
			cell: firewallFirmwareSnip
		},
		{
			key: 'normalizedData.extAddress',
			title: 'External IP',
			searchable: true,
			sortable: true,
			render: ({ row }) => {
				const firewall = row.normalizedData as Firewall;
				const rawFirewall = row.rawData as SophosPartnerFirewall;
				return rawFirewall.externalIpv4Addresses?.join(', ') || firewall.extAddress || 'N/A';
			}
		},
		{
			key: 'normalizedData.lastSeenAt',
			title: 'Status Changed',
			sortable: true,
			render: ({ row }) =>
				new Date((row.normalizedData as Firewall).lastSeenAt).toLocaleDateString()
		}
	]}
/>
