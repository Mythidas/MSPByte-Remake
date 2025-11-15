import { api, Doc } from "@/lib/api";
import NavTemplate from "../nav-template";
import { client } from "@workspace/shared/lib/convex";
import { NavItem } from "@/types/navigation";
import { IntegrationProvider } from "./integration-provider";

type Props = {
    children: React.ReactNode;
}

export default async function HaloPSALayout({ children }: Props) {
    const integration = await client.query(api.integrations.query_s.getBySlug, { slug: 'halopsa', secret: process.env.CONVEX_API_KEY! })
    const navigation: NavItem[] = [
        {
            label: 'Overview',
            href: '/secure/default/integrations/halopsa',
            isExact: true
        },
        {
            label: 'Setup',
            href: '/secure/default/integrations/halopsa/setup',
        },
        {
            label: 'Sync Management',
            href: '/secure/default/integrations/halopsa/sync',
        },
        {
            label: 'Company Mapping',
            href: '/secure/default/integrations/halopsa/companies',
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
