import type { ReactNode } from 'react';

interface FilterBarProps {
    search?: {
        value: string;
        onChange: (value: string) => void;
        placeholder?: string;
    };
    filters?: ReactNode;
    resultCount?: number;
    resultLabel?: string;
    children?: ReactNode;
}

export default function FilterBar({ search, filters, resultCount, resultLabel, children }: FilterBarProps) {
    return (
        <div className="filter-bar">
            {search && (
                <input
                    className="search-input"
                    placeholder={search.placeholder || 'Search...'}
                    value={search.value}
                    onChange={e => search.onChange(e.target.value)}
                />
            )}
            {filters}
            {children}
            {resultCount !== undefined && (
                <span className="result-count">{resultCount} {resultLabel || 'projects'}</span>
            )}
        </div>
    );
}
