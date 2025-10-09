import { createClient } from '$lib/database/client.js';
import { ORM } from '$lib/database/orm.js';
import type { Tables } from '@workspace/shared/types/database/index.js';
import { useConvexClient } from 'convex-svelte';
import type { ConvexClient } from 'convex/browser';
import { getContext, setContext } from 'svelte';

type AppStateConfig = {
	user: Tables<'users_view'>;
	enabled_integrations: Tables<'enabled_integrations_view'>;

	site?: Tables<'sites_view'>;
	site_enabled_integrations?: Tables<'site_integrations_view'>;
};

interface AppState {
	orm: ORM;
	convex: ConvexClient;
	user: Tables<'users_view'>;
	enabled_integrations: Tables<'enabled_integrations_view'>;
	site_enabled_integrations?: Tables<'site_integrations_view'>;

	getSite: () => Tables<'sites_view'> | undefined;
	setSite: (site: Tables<'sites_view'> | undefined) => void;
}

class AppStateClass implements AppState {
	orm: ORM;
	convex: ConvexClient = useConvexClient();
	user: Tables<'users_view'>;
	enabled_integrations: Tables<'enabled_integrations_view'>;
	site_enabled_integrations?: Tables<'site_integrations_view'>;

	private site?: Tables<'sites_view'>;

	constructor(config: AppStateConfig) {
		this.orm = new ORM(createClient());
		this.user = $state(config.user);
		this.enabled_integrations = $state(config.enabled_integrations);

		this.site = $state(config.site);
		this.site_enabled_integrations = $state(config.site_enabled_integrations);
	}

	getSite = () => this.site;
	setSite = async (site: Tables<'sites_view'> | undefined) => {
		this.site = site;
		await this.orm.updateRow('users', {
			id: this.user.id!,
			row: {
				metadata: {
					...(this.user.metadata as any),
					current_site: site?.id || undefined
				}
			}
		});
	};
}

const NAV_STATE_KEY = Symbol('nav-state');

export const getAppState = (): AppState => {
	return getContext<AppState>(NAV_STATE_KEY);
};

export const setAppState = (config: AppStateConfig): AppState => {
	const state = new AppStateClass(config);
	setContext<AppState>(NAV_STATE_KEY, state);
	return state;
};
