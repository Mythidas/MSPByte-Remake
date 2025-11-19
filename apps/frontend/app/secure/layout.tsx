import SideNavbar from "@/components/SideNavbar";
import { TopNavbar } from "@/components/TopNavbar";
import { withAuth } from "@workos-inc/authkit-nextjs";
import { ReactNode } from "react";

export default async function CoreLayout({ children }: { children: ReactNode }) {
    const { user } = await withAuth({ ensureSignedIn: true });
    console.log(`User ${user.email} is logged in`);

    return (
        <div className="relative flex flex-col size-full p-2 overflow-hidden">
            {/* SVG Dot Grid Background */}
            <div className="absolute inset-0 -z-10">
                <svg className="size-full" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                        <pattern id="dot-grid" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
                            <circle cx="2" cy="2" r="1" className="fill-foreground/[0.12]" />
                        </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#dot-grid)" />
                </svg>
            </div>

            <TopNavbar />
            <div className="flex gap-4 size-full overflow-hidden">
                <SideNavbar />
                <div className="flex flex-col size-full overflow-hidden pt-2">
                    {children}
                </div>
            </div>
        </div>
    )
}
