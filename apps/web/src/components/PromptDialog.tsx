import { useState, useEffect, useRef } from 'react';
import Dialog from './Dialog';

interface PromptDialogProps {
    open: boolean;
    onClose: () => void;
    onSubmit: (value: string) => void;
    title: string;
    placeholder?: string;
    defaultValue?: string;
}

export default function PromptDialog({ open, onClose, onSubmit, title, placeholder, defaultValue = '' }: PromptDialogProps) {
    const [value, setValue] = useState(defaultValue);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (open) {
            setValue(defaultValue);
            // Auto-focus input after dialog animation
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [open, defaultValue]);

    const handleSubmit = () => {
        const trimmed = value.trim();
        if (!trimmed) return;
        onSubmit(trimmed);
        onClose();
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            title={title}
            maxWidth={420}
            footer={
                <>
                    <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
                    <button className="btn btn-primary" onClick={handleSubmit} disabled={!value.trim()}>OK</button>
                </>
            }
        >
            <input
                ref={inputRef}
                className="form-input"
                value={value}
                onChange={e => setValue(e.target.value)}
                placeholder={placeholder}
                onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }}
            />
        </Dialog>
    );
}
