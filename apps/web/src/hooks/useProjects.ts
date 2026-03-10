import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { StatusData } from '../lib/types';
import { useAuth } from './useAuth';

interface AuthUser {
    orgId?: string;
    [key: string]: unknown;
}

export function useProjects(scope: 'main' | 'child' | 'all' = 'main') {
    const { user } = useAuth();
    const orgId = (user as AuthUser | undefined)?.orgId;

    const queryArgs = orgId
        ? scope === 'all'
            ? { orgId: orgId as any }
            : { orgId: orgId as any, scope }
        : "skip" as const;

    const projectsList = useQuery(api.projects.list, queryArgs);
    const statsQueryArgs = orgId
        ? scope === 'all'
            ? { orgId: orgId as any }
            : { orgId: orgId as any, scope }
        : "skip" as const;
    const projectStats = useQuery(api.projects.getStats, statsQueryArgs);

    const loading = projectsList === undefined || projectStats === undefined;
    const error = null;

    let data: StatusData | null = null;

    if (projectsList && projectStats) {
        data = {
            generated_at: new Date().toISOString(),
            total_projects: projectStats.total,
            summary: {
                by_tier: projectStats.byTier,
                by_lane: projectStats.byLane,
                by_priority: projectStats.byPriority,
                by_stack: projectStats.byStack,
            },
            projects: projectsList.map((p) => ({
                id: (p as any)._id,
                name: p.name,
                description: p.description || '',
                tier: p.tier,
                lane: p.lane,
                priority: p.priority,
                oss: p.oss || false,
                stack: p.stack || [],
                repo: p.repo || null,
                deploy_url: p.deployUrl || null,
                last_active: p.lastActive ? new Date(p.lastActive).toISOString() : null,
                tags: p.tags || [],
                notes: p.notes || '',
                path: p.repo || '',
                yaml_path: p.repo ? `${p.repo}/PROJECT.yaml` : '',
                health_score: p.healthScore || 0,
                // New fields
                project_scope: p.projectScope || 'main',
                project_type: p.projectType || undefined,
                child_type: p.childType || undefined,
                parent_project: p.parentProject || undefined,
            })),
        };
    }

    const runScan = async () => {
        console.log('Filesystem scanning is disabled in SaaS mode. Projects are synced from GitHub.');
    };

    const refresh = () => {
        // useQuery is reactive, so explicit refresh is usually not needed.
    };

    return { data, loading, error, refresh, runScan };
}
