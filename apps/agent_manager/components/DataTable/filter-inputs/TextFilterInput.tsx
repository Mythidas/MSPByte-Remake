"use client";

import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { FilterOperator, FilterConfig } from "../types";
import { getOperatorLabel } from "../utils/filters";

interface TextFilterInputProps {
  config: FilterConfig;
  operator: FilterOperator;
  value: string;
  onOperatorChange: (operator: FilterOperator) => void;
  onValueChange: (value: string) => void;
}

export function TextFilterInput({
  config,
  operator,
  value,
  onOperatorChange,
  onValueChange,
}: TextFilterInputProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Operator</Label>
        <Select
          value={operator}
          onValueChange={(v) => onOperatorChange(v as FilterOperator)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {config.operators.map((op) => (
              <SelectItem key={op} value={op}>
                {getOperatorLabel(op)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Value</Label>
        <Input
          placeholder={config.placeholder || "Enter value..."}
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
        />
      </div>
    </div>
  );
}
