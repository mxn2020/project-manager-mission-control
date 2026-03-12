import { useId, type InputHTMLAttributes } from 'react';

interface FormCheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
    /** Label displayed next to the checkbox */
    label?: string;
    /** Size variant */
    checkboxSize?: 'sm' | 'md';
}

export default function FormCheckbox({
    label,
    checkboxSize = 'md',
    className,
    id: propId,
    ...props
}: FormCheckboxProps) {
    const autoId = useId();
    const id = propId || autoId;
    const sizeClass = checkboxSize === 'sm' ? 'form-checkbox-sm' : '';

    return (
        <label htmlFor={id} className={`form-checkbox-label ${className || ''}`}>
            <input
                id={id}
                type="checkbox"
                className={`form-checkbox ${sizeClass}`}
                {...props}
            />
            <span className="form-checkbox-toggle" />
            {label && <span className="form-checkbox-text">{label}</span>}
        </label>
    );
}
