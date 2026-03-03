import type { CSSProperties } from 'react';
import type { Tier, Priority } from '../../lib/types';
import { TIER_CONFIG, PRIORITY_CONFIG } from '../../lib/types';

type BadgeVariant = 'tier' | 'health' | 'oss' | 'priority' | 'custom';

interface BadgeProps {
    variant: BadgeVariant;
    // For tier variant
    tier?: Tier | string;
    // For priority variant
    priority?: Priority | string;
    // For health variant
    score?: number;
    // For custom variant
    label?: string;
    color?: string;
    bg?: string;
    icon?: string;
    // Shared
    style?: CSSProperties;
    className?: string;
    size?: 'sm' | 'md';
}

export default function Badge({ variant, tier, priority, score, label, color, bg, icon, style, className = '', size = 'md' }: BadgeProps) {
    const sizeStyles = size === 'sm' ? { fontSize: 10, padding: '1px 6px' } : {};

    switch (variant) {
        case 'tier': {
            const cfg = TIER_CONFIG[(tier as Tier)] || TIER_CONFIG.idea;
            return (
                <span className={`tier-badge ${className}`} style={{ color: cfg.color, background: cfg.bg, ...sizeStyles, ...style }}>
                    {cfg.emoji} {cfg.label}
                </span>
            );
        }
        case 'health': {
            const s = score ?? 0;
            const cls = s >= 60 ? 'health-good' : s >= 40 ? 'health-warn' : 'health-bad';
            return <span className={`health-badge ${cls} ${className}`} style={{ ...sizeStyles, ...style }}>{s}</span>;
        }
        case 'oss':
            return <span className={`oss-badge ${className}`} style={{ ...sizeStyles, ...style }}>OSS</span>;
        case 'priority': {
            const cfg = PRIORITY_CONFIG[(priority as Priority)] || PRIORITY_CONFIG.medium;
            return (
                <span className={`ui-badge-priority ${className}`} style={{
                    display: 'flex', alignItems: 'center', gap: 6, fontSize: 13,
                    ...sizeStyles, ...style,
                }}>
                    <span className="priority-dot" style={{ background: cfg.color }} />
                    {cfg.label}
                </span>
            );
        }
        case 'custom':
            return (
                <span className={`ui-badge ${className}`} style={{
                    padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                    background: bg || 'var(--bg-glass)', color: color || 'var(--text-secondary)',
                    ...sizeStyles, ...style,
                }}>
                    {icon && <span style={{ marginRight: 4 }}>{icon}</span>}
                    {label}
                </span>
            );
        default:
            return null;
    }
}
