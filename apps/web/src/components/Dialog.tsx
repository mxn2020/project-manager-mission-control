import { useEffect, type ReactNode } from 'react';

interface DialogProps {
    open: boolean;
    onClose: () => void;
    title: string;
    children: ReactNode;
    footer?: ReactNode;
    maxWidth?: number;
}

export default function Dialog({ open, onClose, title, children, footer, maxWidth = 560 }: DialogProps) {
    // Close on Escape key
    useEffect(() => {
        if (!open) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [open, onClose]);

    // Prevent body scroll when open
    useEffect(() => {
        if (open) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => { document.body.style.overflow = ''; };
    }, [open]);

    if (!open) return null;

    return (
        <div
            className="dialog-overlay"
            onClick={e => { if (e.target === e.currentTarget) onClose(); }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="dialog-title"
        >
            <div className="dialog-box" style={{ maxWidth }} onClick={e => e.stopPropagation()}>
                <div className="dialog-header">
                    <h2 className="dialog-title" id="dialog-title">{title}</h2>
                    <button className="dialog-close" onClick={onClose} aria-label="Close dialog">✕</button>
                </div>
                <div className="dialog-body">
                    {children}
                </div>
                {footer && (
                    <div className="dialog-footer">
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );
}
