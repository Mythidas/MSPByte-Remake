<script lang="ts">
	import { api, type Doc } from '$lib/convex';
	import { useQuery } from 'convex-svelte';
	import { getAppState } from '$lib/state/Application.svelte.js';
	import DataTable from '$lib/components/table/DataTable.svelte';
	import { type DataTableCell } from '$lib/components/table/types.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { type Identity } from '@workspace/database/convex/types/normalized.js';
	import { CircleCheck, CircleX, CircleAlert } from 'lucide-svelte';

	const { dataSourceId }: { dataSourceId: string } = $props();
	const appState = getAppState();

	let filters = $state<any>(undefined);

	const identitiesQuery = useQuery(api.helpers.orm.list, () => ({
		tableName: 'entities' as const,
		filters: filters,
		index: {
			name: 'by_site_type',
			params: {
				siteId: appState.getSite()?._id!,
				entityType: 'identities'
			}
		}
	}));

	const alertsQuery = useQuery(api.helpers.orm.list, {
		tableName: 'entity_alerts',
		index: {
			name: 'by_data_source',
			params: {
				dataSourceId: dataSourceId
			}
		}
	});
	const alerts = $derived((alertsQuery.data || []) as Doc<'entity_alerts'>[]);

	$inspect(alerts);
</script>

{#snippet enabledSnip({ row }: DataTableCell<Doc<'entities'>>)}
	{@const warnings = alerts.filter(
		(alert) => row._id === alert.entityId && alert.severity === 'medium'
	).length}
	{@const errors = alerts.filter(
		(alert) =>
			row._id === alert.entityId && (alert.severity === 'high' || alert.severity === 'critical')
	).length}
	{#if !warnings && !errors}
		<CircleCheck class="text-chart-1 h-4 w-4" />
	{:else if !!errors}
		<CircleX class="text-destructive h-4 w-4" />
	{:else}
		<CircleAlert class="h-4 w-4 text-amber-500" />
	{/if}
{/snippet}

{#snippet tagsSnip({ row }: DataTableCell<Doc<'entities'>>)}
	{@const identity = row.normalizedData as Identity}
	{@const tags = identity.tags || []}
	<div class="flex flex-wrap gap-1">
		{#each tags as tag}
			{#if tag === 'MFA'}
				<Badge variant="default" class="bg-chart-1 text-xs">MFA</Badge>
			{:else if tag === 'Admin'}
				<Badge variant="destructive" class="text-xs">Admin</Badge>
			{:else if tag === 'Stale'}
				<Badge variant="secondary" class="text-xs">Stale</Badge>
			{:else if tag === 'Guest'}
				<Badge variant="outline" class="text-xs">Guest</Badge>
			{:else}
				<Badge variant="outline" class="text-xs">{tag}</Badge>
			{/if}
		{/each}
	</div>
{/snippet}

<DataTable
	rows={identitiesQuery.data || []}
	isLoading={identitiesQuery.isLoading}
	bind:filters
	columns={[
		{
			key: 'normalizedData.enabled',
			title: '',
			sortable: true,
			cell: enabledSnip,
			width: '48px',
			filter: {
				label: 'Status',
				component: 'select',
				operators: ['eq', 'ne'],
				defaultOperator: 'eq',
				options: [
					{ label: 'Enabled', value: true },
					{ label: 'Disabled', value: false }
				],
				placeholder: 'Select status'
			}
		},
		{
			key: 'normalizedData.name',
			title: 'Name',
			searchable: true,
			sortable: true,
			render: ({ row }) => (row.normalizedData as Identity).name
		},
		{
			key: 'normalizedData.email',
			title: 'Email',
			searchable: true,
			sortable: true,
			render: ({ row }) => (row.normalizedData as Identity).email
		},
		{
			key: 'normalizedData.type',
			title: 'Type',
			sortable: true,
			render: ({ row }) => {
				const type = (row.normalizedData as Identity).type;
				return type.charAt(0).toUpperCase() + type.slice(1);
			},
			filter: {
				label: 'Type',
				component: 'select',
				operators: ['eq', 'ne'],
				defaultOperator: 'eq',
				options: [
					{ label: 'Member', value: 'member' },
					{ label: 'Guest', value: 'guest' }
				],
				placeholder: 'Select type'
			}
		},
		{
			key: 'normalizedData.tags',
			title: 'Tags',
			cell: tagsSnip,
			width: '200px',
			filter: {
				label: 'Tags',
				component: 'select',
				operators: ['in', 'nin'],
				defaultOperator: 'in',
				options: [
					{ label: 'MFA', value: 'MFA' },
					{ label: 'Guest', value: 'Guest' },
					{ label: 'Disabled', value: 'Disabled' },
					{ label: 'Admin', value: 'Admin' },
					{ label: 'Stale', value: 'Stale' }
				],
				placeholder: 'Select tag'
			}
		},
		{
			key: 'normalizedData.licenses',
			title: 'Licenses',
			sortable: true,
			render: ({ row }) => {
				const licenses = (row.normalizedData as Identity).licenses || [];
				return licenses.length.toString();
			}
		},
		{
			key: 'normalizedData.last_login_at',
			title: 'Last Login',
			sortable: true,
			render: ({ row }) => {
				const lastLogin = (row.normalizedData as Identity).last_login_at;
				return lastLogin ? new Date(lastLogin).toLocaleString() : 'Never';
			}
		}
	]}
/>
