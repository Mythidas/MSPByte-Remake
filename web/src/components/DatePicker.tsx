import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format, parse } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { useState } from "react";

interface Props {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export default function DatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
  className,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const date = value
    ? parse(value.substring(0, 10), "yyyy-MM-dd", new Date())
    : undefined;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={"outline"}
          className={cn(
            "justify-start text-left font-normal",
            !date && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {date ? format(date, "PPP") : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0">
        <Calendar
          mode="single"
          selected={date}
          onSelect={(selectedDate) => {
            if (selectedDate) {
              onChange(format(selectedDate, "yyyy-MM-dd"));
            } else {
              onChange("");
            }

            setIsOpen(false);
          }}
          classNames={{
            day_selected: "bg-primary text-primary-foreground hover:bg-primary", // no hover effect override
            day: "rounded-md w-9 h-9 p-0 font-normal aria-selected:opacity-100",
            selected: "bg-primary",
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
