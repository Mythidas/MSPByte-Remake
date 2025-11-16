"use client";

import { Doc } from "@/lib/api";
import { NavItem } from "@/types/navigation";
import { prettyText } from "@workspace/shared/lib/utils";
import { Breadcrumb, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@workspace/ui/components/breadcrumb";
import { usePathname } from "next/navigation";
import { Separator } from "@workspace/ui/components/separator";
import { NavGroup } from "@/components/SideNavbar/NavGroup";
import { NavItem as NavItemC } from "@/components/SideNavbar/NavItem";
import React from "react";

type Props = {
    integration: Doc<'integrations'>;
    items: NavItem[];
    children: React.ReactNode;
}

export default function NavTemplate({ integration, items, children }: Props) {
    return (
        <div className="flex flex-col gap-2 size-full">
            <div className="h-10">
                <BreadcrumbBuilder root="integrations" />
            </div>
            <Separator />
            <div className="flex gap-2 size-full overflow-hidden">
                <div className="flex flex-col p-2 gap-1 w-46 bg-card/50 shadow rounded border h-full">
                    <SidenavBuilder items={items} />
                </div>
                <div className="flex size-full overflow-hidden">
                    {children}
                </div>
            </div>
        </div>
    )
}

function BreadcrumbBuilder({ root }: { root: string }) {
    const pathname = usePathname();
    const parts = pathname.split('/');
    const start = parts.findIndex((p) => p === root) || 0;

    const getLink = (index: number) => {
        const subParts = parts.slice(start + 1, index + 1);
        return parts.slice(0, start + 1).join('/') + '/' + subParts.join('/');
    }

    if (parts.length === 0 || start >= parts.length) return;

    return (
        <Breadcrumb>
            <BreadcrumbList>
                {parts.map((part, idx) => {
                    if (idx < start) return;
                    if (idx === parts.length - 1) {
                        return <BreadcrumbPage key={idx}>{prettyText(part)}</BreadcrumbPage>
                    }

                    return (
                        <React.Fragment key={idx}>
                            <BreadcrumbLink href={getLink(idx)}>{prettyText(part)}</BreadcrumbLink>
                            <BreadcrumbSeparator />
                        </React.Fragment>
                    )
                })}
            </BreadcrumbList>
        </Breadcrumb>
    )
}

function SidenavBuilder({ items }: { items: NavItem[] }) {
    return items.map((item, idx) => {
        if (item.children && item.children.length > 0) {
            return <NavGroup key={idx} item={item} />;
        }
        return <NavItemC key={idx} item={item} />;
    })
}
