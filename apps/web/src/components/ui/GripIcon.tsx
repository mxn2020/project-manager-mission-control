interface GripIconProps {
    size?: number;
    className?: string;
}

export default function GripIcon({ size = 16, className = '' }: GripIconProps) {
    return (
        <svg
            className={`grip-icon ${className}`}
            width={size}
            height={size}
            viewBox="0 0 16 16"
            fill="currentColor"
            aria-hidden="true"
        >
            <circle cx="5" cy="3" r="1.5" />
            <circle cx="11" cy="3" r="1.5" />
            <circle cx="5" cy="8" r="1.5" />
            <circle cx="11" cy="8" r="1.5" />
            <circle cx="5" cy="13" r="1.5" />
            <circle cx="11" cy="13" r="1.5" />
        </svg>
    );
}
