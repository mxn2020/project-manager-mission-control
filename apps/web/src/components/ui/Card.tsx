import type { ReactNode, CSSProperties } from 'react';

interface CardProps {
    children: ReactNode;
    onClick?: () => void;
    className?: string;
    accentColor?: string;
    style?: CSSProperties;
    padding?: number | string;
}

export default function Card({ children, onClick, className = '', accentColor, style, padding }: CardProps) {
    return (
        <div
            className={`ui-card ${onClick ? 'ui-card-clickable' : ''} ${className}`}
            onClick={onClick}
            style={style}
        >
            {accentColor && (
                <div
                    className="ui-card-accent"
                    style={{ background: accentColor }}
                />
            )}
            <div className="ui-card-body" style={padding !== undefined ? { padding } : undefined}>
                {children}
            </div>
        </div>
    );
}
