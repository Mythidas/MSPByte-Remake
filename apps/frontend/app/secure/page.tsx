"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SecurePage() {
    const router = useRouter();

    useEffect(() => {
        router.replace('/secure/default');
    }, [router]);

    return null;
}
