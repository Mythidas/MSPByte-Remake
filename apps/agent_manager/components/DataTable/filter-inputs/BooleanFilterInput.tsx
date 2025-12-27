"use client";

import { Label } from "@workspace/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";

interface BooleanFilterInputProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
}

export function BooleanFilterInput({
  value,
  onValueChange,
}: BooleanFilterInputProps) {
  return (
    <div className="space-y-2">
      <Label>Value</Label>
      <Select
        value={String(value)}
        onValueChange={(v) => onValueChange(v === "true")}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="true">Yes / True</SelectItem>
          <SelectItem value="false">No / False</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
