import { api, Doc } from "@/lib/api";
import NavTemplate from "../nav-template";
import { client } from "@workspace/shared/lib/convex";
import { NavItem } from "@/types/navigation";
import { IntegrationProvider } from "./integration-provider";

type Props = {
    children: React.ReactNode;
}

export default async function DattoRMMLayout({ children }: Props) {
    const integration = await client.query(api.integrations.query_s.getBySlug, { slug: 'datto-rmm', secret: process.env.CONVEX_API_KEY! })
    const navigation: NavItem[] = [
        {
            label: 'Overview',
            href: '/secure/default/integrations/datto-rmm',
            isExact: true
        },
        {
            label: 'Setup',
            href: '/secure/default/integrations/datto-rmm/setup',
        },
        {
            label: 'Sync',
            href: '/secure/default/integrations/datto-rmm/sync',
        },
        {
            label: 'Site Mapping',
            href: '/secure/default/integrations/datto-rmm/sites',
        }
    ]

    return (
        <IntegrationProvider integration={integration as Doc<'integrations'>}>
            <NavTemplate integration={integration as Doc<'integrations'>} items={navigation}>
                {children}
            </NavTemplate>
        </IntegrationProvider>
    );
}
