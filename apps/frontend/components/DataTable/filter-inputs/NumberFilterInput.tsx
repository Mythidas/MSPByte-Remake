"use client";

import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/select";
import { FilterOperator, FilterConfig } from "../types";
import { getOperatorLabel } from "../utils/filters";

interface NumberFilterInputProps {
    config: FilterConfig;
    operator: FilterOperator;
    value: number;
    onOperatorChange: (operator: FilterOperator) => void;
    onValueChange: (value: number) => void;
}

export function NumberFilterInput({
    config,
    operator,
    value,
    onOperatorChange,
    onValueChange,
}: NumberFilterInputProps) {
    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <Label>Operator</Label>
                <Select value={operator} onValueChange={(v) => onOperatorChange(v as FilterOperator)}>
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
                    type="number"
                    placeholder={config.placeholder || "Enter number..."}
                    value={value || ""}
                    onChange={(e) => onValueChange(parseFloat(e.target.value) || 0)}
                />
            </div>
        </div>
    );
}
