import { useState } from 'react';

interface Task {
    id: string;
    title: string;
    projectPath: string;
    status: 'todo' | 'in_progress' | 'done';
    priority: 'high' | 'medium' | 'low';
    effort: string;
}

const SAMPLE_TASKS: Task[] = [
    { id: '1', title: 'Set up Convex Auth', projectPath: 'mission-control-app', status: 'in_progress', priority: 'high', effort: 'M' },
    { id: '2', title: 'Connect AI provider', projectPath: 'mission-control-app', status: 'todo', priority: 'high', effort: 'L' },
    { id: '3', title: 'Deploy to Hetzner VPS', projectPath: 'mission-control-app', status: 'todo', priority: 'high', effort: 'M' },
    { id: '4', title: 'Build sync script', projectPath: 'antigravity', status: 'todo', priority: 'medium', effort: 'L' },
];

export default function TasksPage() {
    const [tasks, setTasks] = useState(SAMPLE_TASKS);
    const [filter, setFilter] = useState('all');

    const filtered = tasks.filter(t => filter === 'all' || t.status === filter);
    const toggleStatus = (id: string) => {
        setTasks(prev => prev.map(t => t.id === id ? { ...t, status: t.status === 'done' ? 'todo' : t.status === 'todo' ? 'in_progress' : 'done' as any } : t));
    };

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">Tasks</h1>
                <p className="page-description">Cross-project task management (Convex integration pending)</p>
            </div>
            <div className="filter-bar">
                {['all', 'todo', 'in_progress', 'done'].map(f => (
                    <button
                        key={f}
                        className={`btn ${filter === f ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setFilter(f)}
                        style={{ textTransform: 'capitalize' }}
                    >
                        {f === 'all' ? 'All' : f.replace('_', ' ')}
                    </button>
                ))}
                <span className="result-count">{filtered.length} tasks</span>
            </div>
            <div className="task-list">
                {filtered.map(t => (
                    <div key={t.id} className="task-item">
                        <div className={`task-checkbox ${t.status === 'done' ? 'done' : ''}`} onClick={() => toggleStatus(t.id)}>
                            {t.status === 'done' && '✓'}
                        </div>
                        <div style={{ flex: 1 }}>
                            <div className="task-title" style={{ textDecoration: t.status === 'done' ? 'line-through' : 'none', opacity: t.status === 'done' ? 0.5 : 1 }}>{t.title}</div>
                            <div className="task-project">{t.projectPath}</div>
                        </div>
                        <span className={`health-badge ${t.priority === 'high' ? 'health-bad' : t.priority === 'medium' ? 'health-warn' : 'health-good'}`}>{t.priority}</span>
                        <span className="task-effort">{t.effort}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
