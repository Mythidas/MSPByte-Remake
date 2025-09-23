import { cn } from "@/lib/utils";
import Link from "next/link";

type Props = {
  children: React.ReactNode;
  lead?: React.ReactNode;
  href?: string;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
} & Omit<React.ComponentProps<"a">, "onClick" | "href">;

export default function Display({
  lead,
  className,
  children,
  href = "",
  onClick,
  ...props
}: Props) {
  const spanClass = cn(
    "flex w-full select-text text-sm font-medium space-x-2 justify-start items-center",
    className
  );

  if (!onClick && !href) {
    return (
      <div
        className={cn(
          "flex items-center w-full gap-2 p-2 rounded border bg-card",
          onClick && "hover:cursor-pointer hover:bg-input/30"
        )}
      >
        {lead && <span className="h-4 w-4 text-muted-foreground">{lead}</span>}
        <span className={spanClass}>{children}</span>
      </div>
    );
  }

  if (!href) {
    return (
      <button
        className={cn(
          "flex items-center w-full gap-2 p-2 rounded border bg-card",
          onClick && "hover:cursor-pointer hover:bg-input/30"
        )}
        onClick={onClick}
      >
        {lead && <span className="h-4 w-4 text-muted-foreground">{lead}</span>}
        <span className={spanClass}>{children}</span>
      </button>
    );
  }

  return (
    <Link
      className={cn(
        "flex items-center w-full gap-2 p-2 rounded border bg-card",
        "hover:bg-input/30 hover:cursor-pointer"
      )}
      {...props}
      href={href}
    >
      {lead && <span className="h-4 w-4 text-muted-foreground">{lead}</span>}
      <span
        className={cn(
          "flex w-full select-text text-sm font-medium space-x-2 justify-start items-center",
          className
        )}
      >
        {children}
      </span>
    </Link>
  );
}
