import { api, Doc } from "@/lib/api";
import { client } from "@workspace/shared/lib/convex";
import { IntegrationProvider } from "./integration-provider";

type Props = {
    children: React.ReactNode;
}

export default async function Microsoft365Layout({ children }: Props) {
    const integration = await client.query(
        api.integrations.query_s.getBySlug,
        {
            slug: 'microsoft-365',
            secret: process.env.CONVEX_API_KEY!
        }
    );

    return (
        <IntegrationProvider integration={integration as Doc<'integrations'>}>
            {children}
        </IntegrationProvider>
    );
}
