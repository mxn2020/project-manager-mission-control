import type { Dimension } from '../../lib/dimensions';

interface DimensionPickerProps {
    dimensions: Dimension[];
    selected: string;
    onChange: (dimensionId: string) => void;
    label?: string;
    allowNone?: boolean;
}

export default function DimensionPicker({ dimensions, selected, onChange, label = 'Group by', allowNone = true }: DimensionPickerProps) {
    return (
        <div className="dimension-picker">
            <span className="dimension-picker-label">{label}</span>
            <select
                className="filter-select"
                value={selected}
                onChange={e => onChange(e.target.value)}
            >
                {allowNone && <option value="">No grouping</option>}
                {dimensions.map(d => (
                    <option key={d.id} value={d.id}>
                        {d.icon} {d.label}
                    </option>
                ))}
            </select>
        </div>
    );
}
