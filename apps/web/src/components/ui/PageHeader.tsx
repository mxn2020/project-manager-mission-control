import type { ReactNode } from 'react';

interface PageHeaderProps {
    title: string;
    description?: string;
    actions?: ReactNode;
}

export default function PageHeader({ title, description, actions }: PageHeaderProps) {
    return (
        <div className="page-header">
            <div className="flex-between">
                <div>
                    <h1 className="page-title">{title}</h1>
                    {description && <p className="page-description">{description}</p>}
                </div>
                {actions && <div className="flex-row gap-8 flex-shrink-0">{actions}</div>}
            </div>
        </div>
    );
}
