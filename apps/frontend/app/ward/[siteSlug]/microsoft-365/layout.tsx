"use client";

import { ReactNode } from "react";
import { useWard, useSyncWardFromUrl } from "@/hooks/use-ward";
import { useParams, usePathname, useRouter } from "next/navigation";
import { Button } from "@workspace/ui/components/button";
import { ScrollArea } from "@workspace/ui/components/scroll-area";
import { Separator } from "@workspace/ui/components/separator";
import { cn } from "@workspace/ui/lib/utils";
import {
    Users,
    UsersRound,
    Shield,
    ShieldAlert,
    Lock,
    CreditCard,
    Home,
    ChevronLeft,
} from "lucide-react";

const navigationGroups = [
    {
        label: "Overview",
        items: [
            { label: "Dashboard", href: "", icon: Home },
        ],
    },
    {
        label: "Identity",
        items: [
            { label: "Users", href: "/users", icon: Users },
            { label: "Groups", href: "/groups", icon: UsersRound },
        ],
    },
    {
        label: "Roles & Admins",
        items: [
            { label: "Roles", href: "/roles", icon: Shield },
        ],
    },
    {
        label: "Protection",
        items: [
            { label: "Conditional Access", href: "/conditional-access", icon: Lock },
            { label: "MFA Status", href: "/mfa-status", icon: ShieldAlert },
        ],
    },
    {
        label: "Licenses",
        items: [
            { label: "License Management", href: "/licenses", icon: CreditCard },
        ],
    },
];

export default function Microsoft365Layout({ children }: { children: ReactNode }) {
    const params = useParams();
    const pathname = usePathname();
    const router = useRouter();
    const siteSlug = params.siteSlug as string;
    const { site } = useWard();

    // Sync ward state with URL (mode = microsoft-365)
    useSyncWardFromUrl(siteSlug, "microsoft-365");

    const basePath = `/ward/${siteSlug}/microsoft-365`;

    const isActiveRoute = (href: string) => {
        const fullPath = `${basePath}${href}`;
        if (href === "") {
            return pathname === basePath;
        }
        return pathname === fullPath;
    };

    return (
        <div className="flex h-screen">
            {/* Sidebar */}
            <div className="w-64 border-r bg-muted/20">
                <div className="flex h-full flex-col">
                    {/* Header */}
                    <div className="p-4">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="mb-4 w-full justify-start gap-2"
                            onClick={() => router.push(`/ward/${siteSlug}`)}
                        >
                            <ChevronLeft className="h-4 w-4" />
                            Back to {site?.name}
                        </Button>
                        <div className="flex items-center gap-2">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#0078d4]">
                                <svg className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M0 0h11v11H0zm13 0h11v11H13zM0 13h11v11H0zm13 0h11v11H13z" />
                                </svg>
                            </div>
                            <div>
                                <p className="text-sm font-semibold">Microsoft 365</p>
                                <p className="text-xs text-muted-foreground">Entra ID & Security</p>
                            </div>
                        </div>
                    </div>

                    <Separator />

                    {/* Navigation */}
                    <ScrollArea className="flex-1 px-2 py-4">
                        {navigationGroups.map((group) => (
                            <div key={group.label} className="mb-6">
                                <p className="mb-2 px-2 text-xs font-semibold uppercase text-muted-foreground">
                                    {group.label}
                                </p>
                                <div className="space-y-1">
                                    {group.items.map((item) => {
                                        const Icon = item.icon;
                                        const isActive = isActiveRoute(item.href);
                                        return (
                                            <Button
                                                key={item.href}
                                                variant={isActive ? "secondary" : "ghost"}
                                                size="sm"
                                                className={cn(
                                                    "w-full justify-start gap-2",
                                                    isActive && "bg-secondary font-medium"
                                                )}
                                                onClick={() => router.push(`${basePath}${item.href}`)}
                                            >
                                                <Icon className="h-4 w-4" />
                                                {item.label}
                                            </Button>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </ScrollArea>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-auto">
                <div className="container mx-auto py-6">{children}</div>
            </div>
        </div>
    );
}
