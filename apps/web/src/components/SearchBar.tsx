"use client";

import { Input } from "@workspace/ui/components//input";
import { useDebouncedValue } from "@/lib/hooks/useDebouncedValue";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

type Props = {
  delay?: number;
  onSearch?: (query: string) => void;
  lead?: React.ReactNode;
  placeholder?: string;
  value?: string;
} & React.ComponentProps<typeof Input>;

export function SearchBar({
  delay = 0,
  onSearch,
  lead,
  placeholder,
  value,
  className,
  ...props
}: Props) {
  const [query, setQuery] = useState(value || "");
  const debouncedQuery = useDebouncedValue(query, delay);

  // Update internal query when external value changes
  useEffect(() => {
    if (value !== undefined) {
      setQuery(value);
    }
  }, [value]);

  useEffect(() => {
    onSearch?.(debouncedQuery);
  }, [debouncedQuery, onSearch]);

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
          value={query}
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
      value={query}
      onChange={(e) => setQuery(e.target.value)}
      {...props}
    />
  );
}
