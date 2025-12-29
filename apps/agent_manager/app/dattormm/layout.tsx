import Link from "next/link";

type Props = {
  children: React.ReactNode;
};

export default function DattoRMMLayout({ children }: Props) {
  return (
    <div className="flex flex-col size-full">
      {/* Header with breadcrumb */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <Link
            href="/dashboard"
            className="text-muted-foreground hover:text-foreground"
          >
            Dashboard
          </Link>
          <span className="text-muted-foreground">/</span>
          <h1 className="text-3xl font-bold tracking-tight">Datto RMM</h1>
        </div>
        <p className="text-muted-foreground">
          Manage Datto RMM site mappings and variables
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-border mb-6">
        <nav className="flex gap-4">
          <Link
            href="/dattormm"
            className="px-4 py-2 border-b-2 border-transparent hover:border-foreground/50 transition-colors data-[active=true]:border-foreground data-[active=true]:text-foreground"
          >
            Overview
          </Link>
          <Link
            href="/dattormm/setup"
            className="px-4 py-2 border-b-2 border-transparent hover:border-foreground/50 transition-colors data-[active=true]:border-foreground data-[active=true]:text-foreground"
          >
            Setup
          </Link>
          <Link
            href="/dattormm/site-mapping"
            className="px-4 py-2 border-b-2 border-transparent hover:border-foreground/50 transition-colors data-[active=true]:border-foreground data-[active=true]:text-foreground"
          >
            Site Mapping
          </Link>
        </nav>
      </div>

      {/* Page Content */}
      <div className="flex-1 overflow-auto">{children}</div>
    </div>
  );
}
