// ─── Types ───────────────────────────────────────────────────────────────────

export type Tier = 'idea' | 'prototype' | 'building' | 'shipped' | 'maintaining' | 'archived';
export type Priority = 'high' | 'medium' | 'low' | 'parked';

export interface Project {
    name: string;
    description: string;
    tier: string;
    lane: string;
    priority: string;
    oss: boolean;
    stack: string[];
    repo: string | null;
    deploy_url: string | null;
    last_active: string | null;
    tags: string[];
    notes: string;
    path: string;
    yaml_path: string;
    health_score: number;
}

export interface StatusData {
    generated_at: string;
    total_projects: number;
    summary: {
        by_tier: Record<string, number>;
        by_lane: Record<string, number>;
        by_priority: Record<string, number>;
        by_stack: Record<string, number>;
    };
    projects: Project[];
}

// ─── Config ──────────────────────────────────────────────────────────────────

export const TIER_ORDER: Tier[] = ['idea', 'prototype', 'building', 'shipped', 'maintaining', 'archived'];
export const PRIORITY_ORDER: Priority[] = ['high', 'medium', 'low', 'parked'];

interface TierCfg { label: string; emoji: string; color: string; bg: string; }
interface PriCfg { label: string; color: string; }

export const TIER_CONFIG: Record<Tier, TierCfg> = {
    idea: { label: 'Idea', emoji: '💡', color: '#a78bfa', bg: 'rgba(167,139,250,0.12)' },
    prototype: { label: 'Prototype', emoji: '🧪', color: '#fbbf24', bg: 'rgba(251,191,36,0.12)' },
    building: { label: 'Building', emoji: '🏗️', color: '#34d399', bg: 'rgba(52,211,153,0.12)' },
    shipped: { label: 'Shipped', emoji: '🚀', color: '#60a5fa', bg: 'rgba(96,165,250,0.12)' },
    maintaining: { label: 'Maintaining', emoji: '🔧', color: '#818cf8', bg: 'rgba(129,140,248,0.12)' },
    archived: { label: 'Archived', emoji: '📦', color: '#6b7280', bg: 'rgba(107,114,128,0.12)' },
};

export const PRIORITY_CONFIG: Record<Priority, PriCfg> = {
    high: { label: 'High', color: '#f87171' },
    medium: { label: 'Medium', color: '#fbbf24' },
    low: { label: 'Low', color: '#60a5fa' },
    parked: { label: 'Parked', color: '#6b7280' },
};

export const LANE_COLORS: Record<string, string> = {
    'minions': '#818cf8',
    'claw-platform': '#34d399',
    'mehdi-verse': '#fbbf24',
    'oss': '#60a5fa',
    'side-projects': '#f472b6',
    'client': '#fb923c',
    'infra': '#a78bfa',
    'uncategorized': '#6b7280',
};

// ─── Workspaces ──────────────────────────────────────────────────────────────

export interface Workspace {
    id: string;
    label: string;
    icon: string;
    path: string;
}

export const WORKSPACES: Workspace[] = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊', path: '/' },
    { id: 'minions', label: 'Minions', icon: '📦', path: '/minions' },
    { id: 'ai', label: 'AI', icon: '🤖', path: '/ai' },
    { id: 'tasks', label: 'Tasks', icon: '📋', path: '/tasks' },
    { id: 'content', label: 'Content', icon: '📢', path: '/content' },
    { id: 'costs', label: 'Costs', icon: '💰', path: '/costs' },
    { id: 'analytics', label: 'Analytics', icon: '📊', path: '/analytics' },
    { id: 'dependencies', label: 'Deps', icon: '🔗', path: '/dependencies' },
    { id: 'admin', label: 'Admin', icon: '🔧', path: '/admin' },
    { id: 'roadmap', label: 'Roadmap', icon: '🗺️', path: '/roadmap' },
    { id: 'integrations', label: 'Integrations', icon: '🔗', path: '/integrations' },
    { id: 'files', label: 'Files', icon: '📂', path: '/files' },
];

