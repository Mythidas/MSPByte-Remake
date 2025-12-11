"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover";
import SearchBar from "@/components/SearchBar";
import { cn } from "@workspace/ui/lib/utils";
import { ScrollArea } from "@workspace/ui/components/scroll-area";
import { Button } from "@workspace/ui/components/button";
import { ClassValue } from "class-variance-authority/types";

type Option = { label: string; value: string };

type Props = {
  options: Option[];
  className?: ClassValue;
  placeholder?: string;
  defaultValue?: string;
  lead?: React.ReactNode;
  leadClass?: ClassValue;
  loading?: boolean;
  delay?: number;
  onSelect?: (value: string) => void;
  onSearch?: (search: string) => void;
};

export default function SearchBox({
  options,
  defaultValue,
  className,
  placeholder,
  lead,
  leadClass,
  loading,
  delay = 0,
  onSelect,
  onSearch,
}: Props) {
  const [selected, setSelected] = useState(defaultValue);
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSelected(defaultValue);
  }, [defaultValue]);

  useEffect(() => {
    if (inputRef.current) inputRef.current.value = "";
    if (!isOpen) {
      setTimeout(() => {
        setSearch("");
      }, 500);
    }
  }, [isOpen]);

  const handleSelect = (option: Option) => {
    setIsOpen(false);
    setSelected(option.value);
    onSelect?.(option.value);
  };

  const handleSearch = useCallback(
    (value: string) => {
      if (onSearch) onSearch(value);
      setSearch(value.toLowerCase());
    },
    [onSearch],
  );

  const filteredOptions = options.filter((o) =>
    o.label.toLowerCase().includes(search),
  );

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen} modal={true}>
      <PopoverTrigger asChild>
        <div className="w-full">
          <SearchBar
            placeholder={
              (selected &&
                options.find((opt) => opt.value === selected)?.label) ||
              placeholder ||
              "Search..."
            }
            onSearch={handleSearch}
            className={cn(lead && "rounded-l-none", className)}
            delay={delay}
            lead={lead}
            leadClass={leadClass}
            defaultValue={defaultValue}
            ref={inputRef}
          />
        </div>
      </PopoverTrigger>
      <PopoverContent
        align="start" // ensures alignment to the left
        className="flex relative w-[--radix-popover-trigger-width] p-0 z-[1000]"
        style={{ width: "var(--radix-popover-trigger-width)" }}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <ScrollArea className="w-full max-h-96" type="always">
          {loading ? (
            <Button disabled variant="ghost" className="w-full">
              Loading...
            </Button>
          ) : (
            <div className="grid w-full">
              {filteredOptions.map((opt) => (
                <Button
                  key={opt.value}
                  variant="ghost"
                  className="w-full justify-start"
                  onClick={() => handleSelect(opt)}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
