import { forwardRef, type SelectHTMLAttributes } from 'react';

export interface FormSelectOption {
    value: string;
    label: string;
}

interface FormSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
    /** Optional label displayed above the select */
    label?: string;
    /** Options to render in the select */
    options?: FormSelectOption[];
    /** Placeholder text for the first empty option */
    placeholderText?: string;
}

const FormSelect = forwardRef<HTMLSelectElement, FormSelectProps>(
    ({ label, options, placeholderText, className, children, ...props }, ref) => {
        const cls = className ? `form-select ${className}` : 'form-select';

        return (
            <>
                {label && <label className="form-label">{label}</label>}
                <select ref={ref} className={cls} {...props}>
                    {placeholderText && <option value="">{placeholderText}</option>}
                    {options
                        ? options.map(opt => (
                              <option key={opt.value} value={opt.value}>
                                  {opt.label}
                              </option>
                          ))
                        : children}
                </select>
            </>
        );
    }
);

FormSelect.displayName = 'FormSelect';

export default FormSelect;
