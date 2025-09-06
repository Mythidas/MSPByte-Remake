"use client";

import { Input } from "@/components/ui/input";
import { useDebouncedValue } from "@/lib/hooks/useDebouncedValue";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

type Props = {
  delay?: number;
  onSearch?: (query: string) => void;
  lead?: React.ReactNode;
  placeholder?: string;
} & React.ComponentProps<typeof Input>;

export default function SearchBar({
  delay = 0,
  onSearch,
  lead,
  placeholder,
  className,
  ...props
}: Props) {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, delay);

  useEffect(() => {
    onSearch?.(debouncedQuery);
  }, [debouncedQuery]);

  if (lead) {
    return (
      <div className={cn("relative flex items-center w-full", className)}>
        <div className="absolute left-3 z-10 flex items-center text-sm text-muted-foreground font-medium">
          {lead}
        </div>
        <Input
          type="search"
          placeholder={placeholder || "Search..."}
          className={cn("pl-10")} // Adjust padding based on your lead content
          onChange={(e) => setQuery(e.target.value)}
          {...props}
        />
      </div>
    );
  }

  return (
    <Input
      type="search"
      placeholder={placeholder || "Search..."}
      className={className}
      onChange={(e) => setQuery(e.target.value)}
      {...props}
    />
  );
}
