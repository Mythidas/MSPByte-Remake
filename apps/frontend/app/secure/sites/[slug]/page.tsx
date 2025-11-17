"use client";

import { useParams } from "next/navigation"
import { Breadcrumb, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@workspace/ui/components/breadcrumb";
import { useQuery } from "convex/react";
import { api } from "@/lib/api";
import Loader from "@workspace/ui/components/Loader";

export default function SitePage() {
    const params = useParams();
    const site = useQuery(api.sites.query.getBySlug, {
        slug: params["slug"]?.toString() || ''
    });

    if (!site) {
        return <Loader />
    }

    return (
        <div>
            <Breadcrumb>
                <BreadcrumbList>
                    <BreadcrumbLink href="/secure/default/sites">Sites</BreadcrumbLink>
                    <BreadcrumbSeparator />
                    <BreadcrumbPage>{site.name}</BreadcrumbPage>
                </BreadcrumbList>
            </Breadcrumb>
        </div>
    )
}
