import { api, type Doc, type Id } from '$lib/convex';
import { useConvexClient } from 'convex-svelte';
import type { ConvexClient } from 'convex/browser';
import { getContext, setContext } from 'svelte';

type SiteLinkedIntegration = { id: Id<'integrations'>; slug: string; name: string };
type Site = Doc<'sites'> & { psaIntegrationName?: string; psaIntegrationSlug?: string };

type AppStateConfig = {
	user: Doc<'users'>;
	site?: Site;
	siteLinkedIntegrations?: SiteLinkedIntegration[];
};

interface AppState {
	convex: ConvexClient;
	user: Doc<'users'>;
	siteLinkedIntegrations?: SiteLinkedIntegration[];

	getSite: () => Site | undefined;
	setSite: (site: Site | undefined) => void;
}

class AppStateClass implements AppState {
	convex: ConvexClient = useConvexClient();
	user: Doc<'users'>;
	siteLinkedIntegrations?: SiteLinkedIntegration[];

	private site?: Site & { psaIntegrationName?: string };

	constructor(config: AppStateConfig) {
		this.user = $state(config.user);

		this.site = $state(config.site);
		this.siteLinkedIntegrations = $state(config.siteLinkedIntegrations);
	}

	getSite = () => this.site;
	setSite = async (site: Doc<'sites'> | undefined) => {
		this.site = site;
		await this.convex.mutation(api.users.mutate.updateMyMetadata, {
			metadata: {
				...this.user.metadata,
				currentSite: site?._id
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
