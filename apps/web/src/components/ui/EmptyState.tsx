interface EmptyStateProps {
    icon: string;
    message: string;
}

export default function EmptyState({ icon, message }: EmptyStateProps) {
    return (
        <div className="empty-state">
            <div className="empty-state-icon">{icon}</div>
            <div className="empty-state-text">{message}</div>
        </div>
    );
}
