import type { ReactNode } from 'react';

interface StatCardProps {
    label: string;
    value: ReactNode;
    sub?: string;
    color?: string;
}

export default function StatCard({ label, value, sub, color }: StatCardProps) {
    return (
        <div className="stat-card">
            <div className="stat-label">{label}</div>
            <div className="stat-value" style={color ? { color } : undefined}>{value}</div>
            {sub && <div className="stat-sub">{sub}</div>}
        </div>
    );
}
