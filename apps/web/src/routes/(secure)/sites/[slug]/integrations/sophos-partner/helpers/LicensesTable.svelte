<script lang="ts">
	import { api, type Doc } from '$lib/convex';
	import { useQuery } from 'convex-svelte';
	import { getAppState } from '$lib/state/Application.svelte.js';
	import DataTable from '$lib/components/table/DataTable.svelte';
	import { type DataTableCell, type TableView } from '$lib/components/table/types.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Progress } from '$lib/components/ui/progress/index.js';
	import { CheckCircle2, Clock, AlertCircle } from 'lucide-svelte';

	const { dataSourceId }: { dataSourceId: string } = $props();

	const appState = getAppState();

	let filters = $state<any>(undefined);

	// Query licenses
	const licensesQuery = useQuery(api.helpers.orm.list, () => ({
		tableName: 'entities' as const,
		filters: filters,
		index: {
			name: 'by_site_type',
			params: {
				siteId: appState.getSite()?._id!,
				entityType: 'licenses'
			}
		}
	}));

	// Helper to check if license is expiring soon
	function isExpiringSoon(endDate: string): boolean {
		const end = new Date(endDate);
		const now = new Date();
		const daysUntilExpiry = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
		return daysUntilExpiry <= 90 && daysUntilExpiry > 0;
	}

	function isExpired(endDate: string): boolean {
		return new Date(endDate) < new Date();
	}

	// Predefined views
	const licenseViews: TableView[] = [
		{
			name: 'all',
			label: 'All Licenses',
			description: 'All firewall licenses',
			icon: CheckCircle2,
			filters: [],
			isDefault: true
		},
		{
			name: 'expiring',
			label: 'Expiring Soon',
			description: 'Licenses expiring within 90 days',
			icon: Clock,
			filters: [] // Would need custom logic to filter by date
		},
		{
			name: 'expired',
			label: 'Expired',
			description: 'Licenses that have expired',
			icon: AlertCircle,
			filters: [] // Would need custom logic to check past dates
		}
	];
</script>

{#snippet endDateSnip({ row }: DataTableCell<Doc<'entities'>>)}
	{@const endDate = row.rawData?.productLicense?.endDate}
	{@const perpetual = row.rawData?.productLicense?.perpetual}
	{#if !endDate || perpetual}
		<Badge variant="outline">Perpetual</Badge>
	{:else}
		{@const expired = isExpired(endDate)}
		{@const expiring = isExpiringSoon(endDate)}
		<div class="flex items-center gap-2">
			<span>{new Date(endDate).toLocaleDateString()}</span>
			{#if expired}
				<Badge variant="destructive">Expired</Badge>
			{:else if expiring}
				<Badge variant="default">Expiring Soon</Badge>
			{/if}
		</div>
	{/if}
{/snippet}

<DataTable
	rows={licensesQuery.data || []}
	isLoading={licensesQuery.isLoading}
	bind:filters
	views={licenseViews}
	columns={[
		{
			key: 'normalizedData.name',
			title: 'License Name',
			searchable: true,
			sortable: true,
			render: ({ row }) => row.normalizedData?.name || 'Unknown'
		},
		{
			key: 'rawData.serialNumber',
			title: 'Serial Number',
			sortable: true,
			render: ({ row }) => row.rawData?.serialNumber || 'N/A'
		},
		{
			key: 'rawData.productLicense.type',
			title: 'Type',
			sortable: true,
			render: ({ row }) => {
				const type = row.rawData?.productLicense?.type || 'unknown';
				return type.charAt(0).toUpperCase() + type.slice(1);
			}
		},
		{
			key: 'rawData.productLicense.startDate',
			title: 'Start Date',
			sortable: true,
			render: ({ row }) =>
				row.rawData?.productLicense?.startDate
					? new Date(row.rawData.productLicense.startDate).toLocaleDateString()
					: 'N/A'
		},
		{
			key: 'rawData.productLicense.endDate',
			title: 'End Date',
			sortable: true,
			cell: endDateSnip
		},
		{
			key: 'rawData.model',
			title: 'Model',
			sortable: true,
			render: ({ row }) =>
				`${row.rawData?.model || 'Unknown'} (${row.rawData?.modelType || 'unknown'})`
		}
	]}
/>
