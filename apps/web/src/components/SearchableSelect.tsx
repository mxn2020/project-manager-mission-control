import { useState, useRef, useEffect, useMemo, useCallback } from 'react';

export interface SelectOption {
    value: string;
    label: string;
    sublabel?: string;
    icon?: string;
    group?: string;
}

interface SearchableSelectProps {
    options: SelectOption[];
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    label?: string;
    allowCreate?: boolean;
    onCreateNew?: (value: string) => void;
    disabled?: boolean;
    clearable?: boolean;
    grouped?: boolean;
    maxHeight?: number;
    width?: string;
}

export default function SearchableSelect({
    options,
    value,
    onChange,
    placeholder = 'Search...',
    label,
    allowCreate = false,
    onCreateNew,
    disabled = false,
    clearable = true,
    grouped = false,
    maxHeight = 260,
    width,
}: SearchableSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [highlightIdx, setHighlightIdx] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    // Find selected option label
    const selectedOpt = options.find(o => o.value === value);

    // Filter options
    const filtered = useMemo(() => {
        if (!search) return options;
        const q = search.toLowerCase();
        return options.filter(o =>
            o.label.toLowerCase().includes(q) ||
            o.sublabel?.toLowerCase().includes(q) ||
            o.value.toLowerCase().includes(q) ||
            o.group?.toLowerCase().includes(q)
        );
    }, [options, search]);

    // Group options if needed
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

    // Flat list for keyboard nav
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

    const handleSelect = useCallback((val: string) => {
        onChange(val);
        setIsOpen(false);
        setSearch('');
    }, [onChange]);

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
                handleSelect(flatList[highlightIdx].value);
            } else if (allowCreate && search && onCreateNew) {
                onCreateNew(search);
                setIsOpen(false);
                setSearch('');
            }
        } else if (e.key === 'Escape') {
            setIsOpen(false);
            setSearch('');
        }
    };

    const showCreate = allowCreate && search && !filtered.some(o => o.label.toLowerCase() === search.toLowerCase());

    return (
        <div ref={containerRef} className="ss-container" style={{ width: width || '100%', position: 'relative' }}>
            {label && <label className="ss-label">{label}</label>}

            {/* Trigger */}
            <div
                className={`ss-trigger ${isOpen ? 'ss-open' : ''} ${disabled ? 'ss-disabled' : ''}`}
                onClick={handleOpen}
            >
                {!isOpen ? (
                    <>
                        <span className="ss-value">
                            {selectedOpt ? (
                                <>
                                    {selectedOpt.icon && <span className="ss-icon">{selectedOpt.icon}</span>}
                                    {selectedOpt.label}
                                </>
                            ) : (
                                <span className="ss-placeholder">{placeholder}</span>
                            )}
                        </span>
                        <span className="ss-chevron">▾</span>
                        {clearable && value && (
                            <button
                                className="ss-clear"
                                onClick={(e) => { e.stopPropagation(); onChange(''); }}
                                title="Clear"
                            >✕</button>
                        )}
                    </>
                ) : (
                    <input
                        ref={inputRef}
                        className="ss-search"
                        value={search}
                        onChange={e => { setSearch(e.target.value); setHighlightIdx(0); }}
                        onKeyDown={handleKeyDown}
                        placeholder={placeholder}
                        autoFocus
                    />
                )}
            </div>

            {/* Dropdown */}
            {isOpen && (
                <div className="ss-dropdown" ref={listRef} style={{ maxHeight }}>
                    {flatList.length === 0 && !showCreate && (
                        <div className="ss-empty">No results found</div>
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
                                            className={`ss-option ${idx === highlightIdx ? 'ss-highlighted' : ''} ${opt.value === value ? 'ss-selected' : ''}`}
                                            onClick={() => handleSelect(opt.value)}
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
                                className={`ss-option ${idx === highlightIdx ? 'ss-highlighted' : ''} ${opt.value === value ? 'ss-selected' : ''}`}
                                onClick={() => handleSelect(opt.value)}
                                onMouseEnter={() => setHighlightIdx(idx)}
                            >
                                {opt.icon && <span className="ss-icon">{opt.icon}</span>}
                                <span className="ss-opt-label">{opt.label}</span>
                                {opt.sublabel && <span className="ss-opt-sub">{opt.sublabel}</span>}
                            </div>
                        ))
                    )}

                    {showCreate && (
                        <div
                            className={`ss-option ss-create ${flatList.length === highlightIdx ? 'ss-highlighted' : ''}`}
                            onClick={() => { onCreateNew?.(search); setIsOpen(false); setSearch(''); }}
                        >
                            <span className="ss-icon">➕</span>
                            <span className="ss-opt-label">Create "{search}"</span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
