import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "@workspace/ui/globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ConvexClientProvider } from "@/lib/convex";

const geistSans = Geist({
    variable: "--font-geist-sans",
    subsets: ["latin"],
});

const geistMono = Geist_Mono({
    variable: "--font-geist-mono",
    subsets: ["latin"],
});

export const metadata: Metadata = {
    title: "MSPByte",
    description: "MSP Management Platform",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" suppressHydrationWarning>
            <body
                className={`${geistSans.variable} ${geistMono.variable} antialiased w-screen h-screen overflow-hidden`}
            >
                <ConvexClientProvider>
                    <ThemeProvider
                        attribute="class"
                        defaultTheme="system"
                        enableSystem
                        disableTransitionOnChange
                    >
                        {children}
                    </ThemeProvider>
                </ConvexClientProvider>
            </body>
        </html>
    );
}
