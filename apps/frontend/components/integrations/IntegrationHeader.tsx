"use client";

import { Badge } from "@workspace/ui/components/badge";
import { Breadcrumb, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@workspace/ui/components/breadcrumb";
import { Button } from "@workspace/ui/components/button";
import { prettyText } from "@workspace/shared/lib/utils";
import { usePathname } from "next/navigation";
import { ComponentType, Fragment, useMemo } from "react";

type IntegrationHeaderProps = {
    integration: {
        _id: string;
        name: string;
        slug: string;
    };
    dataSource?: {
        status: string;
    };
    CustomActions?: ComponentType<{
        integration: any;
        dataSource: any;
    }>;
};

export function IntegrationHeader({ integration, dataSource, CustomActions }: IntegrationHeaderProps) {
    const pathname = usePathname();

    // Generate breadcrumb segments from the current path
    const breadcrumbs = useMemo(() => {
        const pathSegments = pathname.split('/').filter(Boolean);
        const integrationIndex = pathSegments.findIndex(seg => seg === 'integrations');

        if (integrationIndex === -1) return [];

        // Get segments after 'integrations/{slug}'
        const afterIntegration = pathSegments.slice(integrationIndex + 2);

        return afterIntegration.map((segment, index) => {
            const path = '/' + pathSegments.slice(0, integrationIndex + 2 + index + 1).join('/');
            return {
                label: prettyText(segment),
                path,
                isLast: index === afterIntegration.length - 1
            };
        });
    }, [pathname]);

    return (
        <div className="flex h-12 p-4 bg-card/50 border rounded shadow items-center w-full justify-between">
            <Breadcrumb>
                <BreadcrumbList>
                    <BreadcrumbLink href="/secure/default/integrations">Integrations</BreadcrumbLink>
                    <BreadcrumbSeparator />
                    <BreadcrumbLink href={`/secure/default/integrations/${integration.slug}`}>
                        {integration.name}
                    </BreadcrumbLink>
                    {breadcrumbs.map((crumb, idx) => (
                        <Fragment key={idx}>
                            <BreadcrumbSeparator />
                            {crumb.isLast ? (
                                <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                            ) : (
                                <BreadcrumbLink href={crumb.path}>{crumb.label}</BreadcrumbLink>
                            )}
                        </Fragment>
                    ))}
                </BreadcrumbList>
            </Breadcrumb>
            <div className="flex gap-2">
                <Badge className="text-sm">
                    {dataSource ? prettyText(dataSource.status) : 'Available'}
                </Badge>
                {CustomActions ? (
                    <CustomActions integration={integration} dataSource={dataSource} />
                ) : (
                    <Button variant="destructive" className="px-2 h-7 hover:cursor-pointer">
                        Disable
                    </Button>
                )}
            </div>
        </div>
    );
}
