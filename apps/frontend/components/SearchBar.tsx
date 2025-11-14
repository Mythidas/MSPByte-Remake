'use client';

import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { Input } from '@workspace/ui/components/input';
import { cn } from '@workspace/ui/lib/utils';
import { ClassValue } from 'clsx';
import { useEffect, useState } from 'react';

type Props = {
    delay?: number;
    onSearch?: (query: string) => void;
    lead?: React.ReactNode;
    leadClass?: ClassValue;
    placeholder?: string;
} & React.ComponentProps<typeof Input>;

export default function SearchBar({
    delay = 0,
    onSearch,
    lead,
    placeholder,
    leadClass,
    ...props
}: Props) {
    const [query, setQuery] = useState('');
    const debouncedQuery = useDebouncedValue(query, delay);

    useEffect(() => {
        onSearch?.(debouncedQuery); // ← no dependency on onSearch
    }, [debouncedQuery]); // ← this is key

    return (
        <div className="flex w-full">
            {lead && (
                <div
                    className={cn(
                        leadClass,
                        'flex flex-col bg-input rounded rounded-r-none w-fit px-2 py-1 items-center justify-center text-sm'
                    )}
                >
                    {lead}
                </div>
            )}
            <Input
                type="search"
                placeholder={placeholder || 'Search...'}
                className={cn(props.className, lead && 'rounded-l-none')}
                onChange={(e) => setQuery(e.target.value)}
                {...props}
            />
        </div>
    );
}
