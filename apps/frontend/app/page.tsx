"use client";

import Link from "next/link";
import { Button } from "@workspace/ui/components/button";
import { Card } from "@workspace/ui/components/card";
import { ArrowRight, LayoutDashboard } from "lucide-react";
import { useAuthReady } from "@/lib/hooks/useAuthReady";

export default function Home() {
  const { isAuthenticated, isLoading } = useAuthReady();

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background">
      {/* Dot Grid Background */}
      <div className="absolute inset-0 -z-10">
        <svg className="size-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern
              id="dot-grid"
              x="0"
              y="0"
              width="24"
              height="24"
              patternUnits="userSpaceOnUse"
            >
              <circle cx="2" cy="2" r="1" className="fill-foreground/[0.12]" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#dot-grid)" />
        </svg>
      </div>

      {/* Main Content */}
      <main className="flex w-full max-w-4xl flex-col items-center px-6 py-12">
        {/* Logo/Branding */}
        <div className="mb-12 flex items-center gap-3">
          <div className="flex size-12 items-center justify-center rounded bg-primary text-primary-foreground font-bold text-2xl">
            M
          </div>
          <span className="text-3xl font-bold text-foreground">MSPByte</span>
        </div>

        {/* Hero Card */}
        <Card className="w-full bg-card/60 backdrop-blur-sm rounded-lg shadow-lg border p-12 text-center">
          <h1 className="text-5xl font-bold tracking-tight text-foreground mb-6">
            Welcome to MSPByte
          </h1>
          <p className="text-xl text-muted-foreground mb-12 max-w-2xl mx-auto">
            Your comprehensive managed service provider platform. Monitor,
            manage, and secure your infrastructure all in one place.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            {!isLoading && !isAuthenticated && (
              <Button asChild size="lg" className="text-lg px-8 py-6 gap-2">
                <Link href="/auth/login">
                  Get Started
                  <ArrowRight className="size-5" />
                </Link>
              </Button>
            )}

            {!isLoading && isAuthenticated && (
              <Button asChild size="lg" className="text-lg px-8 py-6 gap-2">
                <Link href="/secure">
                  <LayoutDashboard className="size-5" />
                  Go to Dashboard
                </Link>
              </Button>
            )}

            {isLoading && (
              <Button size="lg" disabled className="text-lg px-8 py-6">
                Loading...
              </Button>
            )}
          </div>
        </Card>

        {/* Features */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
          <Card className="bg-card/60 backdrop-blur-sm p-6 text-center">
            <div className="text-4xl mb-3">🔒</div>
            <h3 className="font-semibold text-lg mb-2">Secure</h3>
            <p className="text-sm text-muted-foreground">
              Enterprise-grade security with role-based access control
            </p>
          </Card>
          <Card className="bg-card/60 backdrop-blur-sm p-6 text-center">
            <div className="text-4xl mb-3">📊</div>
            <h3 className="font-semibold text-lg mb-2">Comprehensive</h3>
            <p className="text-sm text-muted-foreground">
              Monitor all your sites and services from a single dashboard
            </p>
          </Card>
          <Card className="bg-card/60 backdrop-blur-sm p-6 text-center">
            <div className="text-4xl mb-3">⚡</div>
            <h3 className="font-semibold text-lg mb-2">Fast</h3>
            <p className="text-sm text-muted-foreground">
              Real-time updates and lightning-fast performance
            </p>
          </Card>
        </div>
      </main>
    </div>
  );
}
