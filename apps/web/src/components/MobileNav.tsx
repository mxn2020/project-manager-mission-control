import { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { WORKSPACES } from '../lib/types';

const BOTTOM_NAV_ITEMS = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊', path: '/' },
    { id: 'tasks', label: 'Tasks', icon: '📋', path: '/tasks' },
    { id: 'ai', label: 'AI', icon: '🤖', path: '/ai' },
    { id: 'ideas', label: 'Ideas', icon: '💡', path: '/ideas' },
    { id: 'more', label: 'More', icon: '≡', path: '' },
];

const NAV_GROUPS = [
    {
        title: 'Dashboard',
        items: [
            { id: 'overview', label: 'Overview', icon: '📊', path: '/' },
            { id: 'grid', label: 'Grid', icon: '🔲', path: '/grid' },
            { id: 'table', label: 'Table', icon: '📋', path: '/table' },
            { id: 'kanban', label: 'Kanban', icon: '📌', path: '/kanban' },
            { id: 'focus', label: 'Focus', icon: '🎯', path: '/focus' },
        ],
    },
    {
        title: 'Work',
        items: WORKSPACES.filter(ws => ['tasks', 'workflows', 'content', 'ideas'].includes(ws.id)),
    },
    {
        title: 'Knowledge',
        items: WORKSPACES.filter(ws => ['wiki', 'roadmap', 'files'].includes(ws.id)),
    },
    {
        title: 'Data',
        items: WORKSPACES.filter(ws => ['minions', 'analytics', 'costs', 'dependencies'].includes(ws.id)),
    },
    {
        title: 'System',
        items: WORKSPACES.filter(ws => ['ai', 'repositories', 'admin'].includes(ws.id)),
    },
];

interface MobileNavProps {
    onSyncClick?: () => void;
    syncLoading?: boolean;
    userName?: string;
    onLogout?: () => void;
}

export default function MobileNav({ onSyncClick, syncLoading, userName, onLogout }: MobileNavProps) {
    const [drawerOpen, setDrawerOpen] = useState(false);
    const location = useLocation();

    // Close drawer on navigation
    useEffect(() => {
        setDrawerOpen(false);
    }, [location.pathname]);

    const activeBottomItem = BOTTOM_NAV_ITEMS.find(item =>
        item.path ? (item.path === '/' ? location.pathname === '/' : location.pathname.startsWith(item.path)) : false
    );

    return (
        <>
            {/* Hamburger button in top bar */}
            <button
                className="mobile-menu-btn"
                onClick={() => setDrawerOpen(true)}
                aria-label="Open navigation"
            >
                ☰
            </button>

            {/* Drawer overlay */}
            <div
                className={`mobile-nav-overlay ${drawerOpen ? 'open' : ''}`}
                onClick={() => setDrawerOpen(false)}
            />

            {/* Side drawer */}
            <nav className={`mobile-nav-drawer ${drawerOpen ? 'open' : ''}`} aria-label="Mobile navigation">
                <div className="mobile-nav-header">
                    <span className="mobile-nav-logo">🚀 Mission Control</span>
                    <button className="mobile-nav-close" onClick={() => setDrawerOpen(false)} aria-label="Close">
                        ✕
                    </button>
                </div>

                <div style={{ flex: 1, overflowY: 'auto' }}>
                    {NAV_GROUPS.map(group => (
                        <div className="mobile-nav-section" key={group.title}>
                            <div className="mobile-nav-section-title">{group.title}</div>
                            {group.items.map(item => (
                                <NavLink
                                    key={item.id ?? item.path}
                                    to={item.path}
                                    end={item.path === '/'}
                                    className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}
                                >
                                    <span className="mobile-nav-item-icon">{item.icon}</span>
                                    {item.label}
                                </NavLink>
                            ))}
                        </div>
                    ))}
                </div>

                {/* Footer */}
                <div style={{
                    padding: '12px 16px',
                    borderTop: '1px solid var(--border)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                }}>
                    <button
                        onClick={onSyncClick}
                        disabled={syncLoading}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px',
                            background: 'var(--bg-glass)', border: '1px solid var(--border)',
                            borderRadius: 8, color: 'var(--text-secondary)', cursor: 'pointer',
                            fontSize: 13, fontFamily: 'inherit', width: '100%',
                            opacity: syncLoading ? 0.5 : 1,
                        }}
                    >
                        {syncLoading ? '⏳ Syncing...' : '🔄 Sync Projects'}
                    </button>
                    {userName && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderRadius: 8, background: 'var(--bg-glass)' }}>
                            <span style={{ fontSize: 13, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                                👤 {userName}
                            </span>
                            <button
                                onClick={onLogout}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, padding: '0 4px', color: 'var(--text-tertiary)' }}
                                title="Sign out"
                            >
                                🚪
                            </button>
                        </div>
                    )}
                </div>
            </nav>

            {/* Bottom Navigation Bar */}
            <nav className="mobile-bottom-nav" aria-label="Bottom navigation">
                {BOTTOM_NAV_ITEMS.map(item => {
                    if (item.id === 'more') {
                        return (
                            <button
                                key="more"
                                className={`mobile-bottom-nav-item ${drawerOpen ? 'active' : ''}`}
                                onClick={() => setDrawerOpen(true)}
                            >
                                <span className="mobile-bottom-nav-icon">≡</span>
                                <span className="mobile-bottom-nav-label">More</span>
                            </button>
                        );
                    }
                    const isActive = item.path === '/'
                        ? location.pathname === '/'
                        : location.pathname.startsWith(item.path);
                    return (
                        <NavLink
                            key={item.id}
                            to={item.path}
                            end={item.path === '/'}
                            className={`mobile-bottom-nav-item ${isActive ? 'active' : ''}`}
                            style={{ textDecoration: 'none' }}
                        >
                            <span className="mobile-bottom-nav-icon">{item.icon}</span>
                            <span className="mobile-bottom-nav-label">{item.label}</span>
                        </NavLink>
                    );
                })}
            </nav>
        </>
    );
}
