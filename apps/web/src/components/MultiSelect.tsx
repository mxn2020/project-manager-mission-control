import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import type { SelectOption } from './SearchableSelect';

interface MultiSelectProps {
    options: SelectOption[];
    value: string[];
    onChange: (value: string[]) => void;
    placeholder?: string;
    label?: string;
    disabled?: boolean;
    grouped?: boolean;
    maxHeight?: number;
    width?: string;
}

export default function MultiSelect({
    options,
    value,
    onChange,
    placeholder = 'Search & select...',
    label,
    disabled = false,
    grouped = false,
    maxHeight = 260,
    width,
}: MultiSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [highlightIdx, setHighlightIdx] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    // Exclude already-selected options from dropdown
    const available = useMemo(() => options.filter(o => !value.includes(o.value)), [options, value]);

    // Filter by search
    const filtered = useMemo(() => {
        if (!search) return available;
        const q = search.toLowerCase();
        return available.filter(o =>
            o.label.toLowerCase().includes(q) ||
            o.sublabel?.toLowerCase().includes(q) ||
            o.value.toLowerCase().includes(q) ||
            o.group?.toLowerCase().includes(q)
        );
    }, [available, search]);

    // Group if needed
    const groups = useMemo(() => {
        if (!grouped) return null;
        const map = new Map<string, SelectOption[]>();
        for (const opt of filtered) {
            const g = opt.group || 'Other';
            if (!map.has(g)) map.set(g, []);
            map.get(g)!.push(opt);
        }
        return map;
    }, [filtered, grouped]);

    const flatList = useMemo(() => {
        if (!grouped || !groups) return filtered;
        const flat: SelectOption[] = [];
        for (const [, opts] of groups) flat.push(...opts);
        return flat;
    }, [filtered, groups, grouped]);

    // Close on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
                setSearch('');
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // Scroll highlighted into view
    useEffect(() => {
        if (!listRef.current) return;
        const el = listRef.current.querySelector(`[data-idx="${highlightIdx}"]`);
        if (el) el.scrollIntoView({ block: 'nearest' });
    }, [highlightIdx]);

    const handleOpen = useCallback(() => {
        if (disabled) return;
        setIsOpen(true);
        setHighlightIdx(0);
        setSearch('');
        setTimeout(() => inputRef.current?.focus(), 10);
    }, [disabled]);

    const handleAdd = useCallback((val: string) => {
        onChange([...value, val]);
        setSearch('');
        setHighlightIdx(0);
        setTimeout(() => inputRef.current?.focus(), 10);
    }, [value, onChange]);

    const handleRemove = useCallback((val: string) => {
        onChange(value.filter(v => v !== val));
    }, [value, onChange]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlightIdx(i => Math.min(i + 1, flatList.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlightIdx(i => Math.max(i - 1, 0));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (flatList[highlightIdx]) {
                handleAdd(flatList[highlightIdx].value);
            }
        } else if (e.key === 'Backspace' && !search && value.length > 0) {
            handleRemove(value[value.length - 1]);
        } else if (e.key === 'Escape') {
            setIsOpen(false);
            setSearch('');
        }
    };

    // Resolve labels for selected values
    const selectedOptions = value.map(v => options.find(o => o.value === v)).filter(Boolean) as SelectOption[];

    return (
        <div ref={containerRef} className="ss-container" style={{ width: width || '100%', position: 'relative' }}>
            {label && <label className="ss-label">{label}</label>}

            {/* Chip area + input */}
            <div
                className={`ss-trigger ${isOpen ? 'ss-open' : ''} ${disabled ? 'ss-disabled' : ''}`}
                onClick={handleOpen}
                style={{ flexWrap: 'wrap', gap: 4, minHeight: 34, height: 'auto', padding: '4px 8px' }}
            >
                {selectedOptions.map(opt => (
                    <span key={opt.value} className="ms-chip">
                        {opt.icon && <span style={{ marginRight: 2 }}>{opt.icon}</span>}
                        {opt.label}
                        <button
                            className="ms-chip-remove"
                            onClick={e => { e.stopPropagation(); handleRemove(opt.value); }}
                        >✕</button>
                    </span>
                ))}
                {isOpen ? (
                    <input
                        ref={inputRef}
                        className="ms-inline-input"
                        value={search}
                        onChange={e => { setSearch(e.target.value); setHighlightIdx(0); }}
                        onKeyDown={handleKeyDown}
                        placeholder={selectedOptions.length === 0 ? placeholder : ''}
                        autoFocus
                    />
                ) : selectedOptions.length === 0 ? (
                    <span className="ss-placeholder">{placeholder}</span>
                ) : null}
            </div>

            {/* Dropdown */}
            {isOpen && (
                <div className="ss-dropdown" ref={listRef} style={{ maxHeight }}>
                    {flatList.length === 0 && (
                        <div className="ss-empty">No more options</div>
                    )}

                    {grouped && groups ? (
                        Array.from(groups.entries()).map(([groupName, groupOpts]) => (
                            <div key={groupName}>
                                <div className="ss-group-header">{groupName}</div>
                                {groupOpts.map(opt => {
                                    const idx = flatList.indexOf(opt);
                                    return (
                                        <div
                                            key={opt.value}
                                            data-idx={idx}
                                            className={`ss-option ${idx === highlightIdx ? 'ss-highlighted' : ''}`}
                                            onClick={() => handleAdd(opt.value)}
                                            onMouseEnter={() => setHighlightIdx(idx)}
                                        >
                                            {opt.icon && <span className="ss-icon">{opt.icon}</span>}
                                            <span className="ss-opt-label">{opt.label}</span>
                                            {opt.sublabel && <span className="ss-opt-sub">{opt.sublabel}</span>}
                                        </div>
                                    );
                                })}
                            </div>
                        ))
                    ) : (
                        flatList.map((opt, idx) => (
                            <div
                                key={opt.value}
                                data-idx={idx}
                                className={`ss-option ${idx === highlightIdx ? 'ss-highlighted' : ''}`}
                                onClick={() => handleAdd(opt.value)}
                                onMouseEnter={() => setHighlightIdx(idx)}
                            >
                                {opt.icon && <span className="ss-icon">{opt.icon}</span>}
                                <span className="ss-opt-label">{opt.label}</span>
                                {opt.sublabel && <span className="ss-opt-sub">{opt.sublabel}</span>}
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}
