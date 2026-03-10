import type { Dimension } from '../../lib/dimensions';
import SearchableSelect from '../SearchableSelect';

interface DimensionPickerProps {
    dimensions: Dimension[];
    selected: string;
    onChange: (dimensionId: string) => void;
    label?: string;
    allowNone?: boolean;
}

export default function DimensionPicker({ dimensions, selected, onChange, label = 'Group by', allowNone = true }: DimensionPickerProps) {
    const options = [
        ...(allowNone ? [{ value: '', label: 'No grouping' }] : []),
        ...dimensions.map(d => ({ value: d.id, label: `${d.icon} ${d.label}` })),
    ];

    return (
        <div className="dimension-picker">
            <span className="dimension-picker-label">{label}</span>
            <SearchableSelect
                options={options}
                value={selected}
                onChange={onChange}
                placeholder="Group by"
                clearable={false}
                width="160px"
            />
        </div>
    );
}
