"use client";

import { useQuery } from "convex/react";
import { api, Doc } from "@/lib/api";
import { Building2, Server, Ticket, AlertCircle } from "lucide-react";
import Link from "next/link";
import { useApp } from "@/lib/hooks/useApp";

export default function Dashboard() {
  const { site: currentSite } = useApp();

  // Fetch agents for the current site using *_s variant
  const agents = useQuery(
    api.helpers.orm.list_s,
    currentSite
      ? {
          secret: process.env.NEXT_PUBLIC_CONVEX_SECRET!,
          tableName: "agents",
          index: {
            name: "by_site",
            params: {
              siteId: currentSite._id,
            },
          },
        }
      : "skip",
  ) as Doc<"agents">[] | undefined;

  // Fetch all sites using *_s variant
  const sites = useQuery(api.helpers.orm.list_s, {
    secret: process.env.NEXT_PUBLIC_CONVEX_SECRET!,
    tableName: "sites",
  }) as Doc<"sites">[] | undefined;

  // Fetch ticket usage for the current site using *_s variant
  const tickets = useQuery(
    api.helpers.orm.list_s,
    currentSite
      ? {
          secret: process.env.NEXT_PUBLIC_CONVEX_SECRET!,
          tableName: "ticket_usage",
          index: {
            name: "by_site",
            params: {
              siteId: currentSite._id,
            },
          },
        }
      : "skip",
  ) as Doc<"ticket_usage">[] | undefined;

  // Show empty state if no site is selected
  if (!currentSite) {
    return (
      <div className="flex flex-col gap-4 items-center justify-center size-full">
        <Building2 className="w-16 h-16 text-muted-foreground" />
        <div className="text-center">
          <h2 className="text-2xl font-semibold mb-2">Select a Site</h2>
          <p className="text-muted-foreground max-w-md">
            Please select a site from the dropdown in the top navigation bar.
          </p>
        </div>
      </div>
    );
  }

  const entityCards = [
    {
      label: "Agents",
      href: "/agents",
      icon: Server,
      count: agents?.length ?? 0,
      description: "Monitored endpoints and devices",
      loading: agents === undefined,
    },
    {
      label: "Sites",
      href: "/sites",
      icon: Building2,
      count: sites?.length ?? 0,
      description: "All managed sites",
      loading: sites === undefined,
    },
    {
      label: "Tickets",
      href: "/tickets",
      icon: Ticket,
      count: tickets?.length ?? 0,
      description: "Support tickets submitted",
      loading: tickets === undefined,
    },
  ];

  return (
    <div className="flex flex-col size-full gap-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Building2 className="w-4 h-4" />
          <p>{currentSite.name}</p>
        </div>
      </div>

      {/* Entity Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {entityCards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.label}
              href={card.href}
              className="bg-card/50 border rounded shadow p-6 hover:bg-card/70 transition-colors group"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded bg-primary/10 group-hover:bg-primary/20 transition-colors">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="font-semibold text-lg">{card.label}</h3>
                </div>
                {card.loading ? (
                  <div className="animate-pulse bg-muted rounded w-12 h-8" />
                ) : (
                  <span className="text-2xl font-bold">{card.count}</span>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {card.description}
              </p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
