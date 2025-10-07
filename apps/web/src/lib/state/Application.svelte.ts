import { createClient } from '$lib/database/client.js';
import { ORM } from '$lib/database/orm.js';
import type { Tables } from '@workspace/shared/types/database/index.js';
import { getContext, setContext } from 'svelte';

type AppStateConfig = {
	user: Tables<'users_view'>;
	site?: Tables<'sites_view'>;
};

interface AppState {
	orm: ORM;
	user: Tables<'users_view'>;

	getSite: () => Tables<'sites_view'> | undefined;
	setSite: (site: Tables<'sites_view'> | undefined) => void;
}

class AppStateClass implements AppState {
	orm: ORM;
	user: Tables<'users_view'>;

	private site: Tables<'sites_view'> | undefined;

	constructor(config: AppStateConfig) {
		this.orm = new ORM(createClient());
		this.site = $state(config.site);
		this.user = $state(config.user);
	}

	getSite = () => this.site;
	setSite = async (site: Tables<'sites_view'> | undefined) => {
		await this.orm.updateRow('users', {
			id: this.user.id!,
			row: {
				metadata: {
					...(this.user.metadata as any),
					current_site: site?.id || undefined
				}
			}
		});
		this.site = site;
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
