import { forwardRef, type TextareaHTMLAttributes } from 'react';

interface FormTextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
    /** Optional label displayed above the textarea */
    label?: string;
}

const FormTextarea = forwardRef<HTMLTextAreaElement, FormTextareaProps>(
    ({ label, className, ...props }, ref) => {
        const cls = className ? `form-textarea ${className}` : 'form-textarea';

        return (
            <>
                {label && <label className="form-label">{label}</label>}
                <textarea ref={ref} className={cls} {...props} />
            </>
        );
    }
);

FormTextarea.displayName = 'FormTextarea';

export default FormTextarea;
