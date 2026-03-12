import { forwardRef, type InputHTMLAttributes } from 'react';

interface FormInputProps extends InputHTMLAttributes<HTMLInputElement> {
    /** Optional label displayed above the input */
    label?: string;
    /** Size variant: 'sm' uses form-input-sm, 'md' (default) uses form-input */
    inputSize?: 'sm' | 'md';
}

const FormInput = forwardRef<HTMLInputElement, FormInputProps>(
    ({ label, inputSize = 'md', className, ...props }, ref) => {
        const baseClass = inputSize === 'sm' ? 'form-input-sm' : 'form-input';
        const cls = className ? `${baseClass} ${className}` : baseClass;

        return (
            <>
                {label && <label className="form-label">{label}</label>}
                <input ref={ref} className={cls} {...props} />
            </>
        );
    }
);

FormInput.displayName = 'FormInput';

export default FormInput;
