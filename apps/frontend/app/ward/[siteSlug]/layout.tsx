"use client";

import { ReactNode, useEffect } from "react";
import { useSyncWardFromUrl } from "@/hooks/use-ward";
import { useParams } from "next/navigation";

export default function SiteLayout({ children }: { children: ReactNode }) {
    const params = useParams();
    const siteSlug = params.siteSlug as string;

    // Sync the ward store with the URL
    useSyncWardFromUrl(siteSlug);

    return <>{children}</>;
}
