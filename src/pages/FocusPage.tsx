import { useNavigate } from 'react-router-dom';
import type { StatusData } from '../lib/types';
import { TIER_CONFIG, LANE_COLORS, type Tier } from '../lib/types';

export default function FocusPage({ data }: { data: StatusData }) {
    const navigate = useNavigate();
    const focusProjects = data.projects
        .filter(p => p.tier === 'building' || p.priority === 'high')
        .sort((a, b) => {
            if (a.tier === 'building' && b.tier !== 'building') return -1;
            if (b.tier === 'building' && a.tier !== 'building') return 1;
            return (a.priority === 'high' ? 0 : 1) - (b.priority === 'high' ? 0 : 1);
        })
        .slice(0, 7);

    return (
        <div className="focus-container">
            <div className="focus-header">
                <h1>🎯 Focus Mode</h1>
                <p>Your highest-priority projects. Everything else fades away.</p>
            </div>

            {focusProjects.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state-icon">✨</div>
                    <div className="empty-state-text">No high-priority or building-tier projects. Set a project to "building" tier or "high" priority to see it here.</div>
                </div>
            ) : (
                focusProjects.map(p => {
                    const tc = TIER_CONFIG[p.tier as Tier] || TIER_CONFIG.idea;
                    return (
                        <div key={p.path} className="focus-card" onClick={() => navigate(`/project/${encodeURIComponent(p.path)}`)}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                                <div className="focus-card-name">{p.name}</div>
                                <span className="tier-badge" style={{ color: tc.color, background: tc.bg }}>{tc.emoji} {tc.label}</span>
                            </div>
                            <div className="focus-card-description">{p.description}</div>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                <span style={{ color: LANE_COLORS[p.lane] || 'var(--text-tertiary)', fontSize: 12, fontWeight: 600 }}>{p.lane}</span>
                                <span className={`health-badge ${p.health_score >= 60 ? 'health-good' : p.health_score >= 40 ? 'health-warn' : 'health-bad'}`}>{p.health_score}</span>
                                {p.oss && <span className="oss-badge">OSS</span>}
                            </div>
                        </div>
                    );
                })
            )}
        </div>
    );
}
