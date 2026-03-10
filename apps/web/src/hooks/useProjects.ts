import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { StatusData, Project } from '../lib/types';
import { useAuth } from './useAuth';

export function useProjects() {
    const { user } = useAuth();
    const orgId = (user as any)?.orgId;

    const projectsList = useQuery(api.projects.list, orgId ? { orgId } : "skip");
    const projectStats = useQuery(api.projects.getStats, orgId ? { orgId } : "skip");

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
            // Map Convex _id to id, and ensure other properties match Project interface
            projects: projectsList.map((p: any) => ({
                id: p._id,
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
                path: p.repo || '', // Fallback since we moved from FS
                yaml_path: p.repo ? `${p.repo}/PROJECT.yaml` : '',
                health_score: p.healthScore || 0,
            })),
        };
    }

    // runScan is a placeholder now since scanning filesystem is obsolete
    const runScan = async () => {
        console.log('Filesystem scanning is disabled in SaaS mode. Projects are synced from GitHub.');
    };

    const refresh = () => {
        // useQuery is reactive, so explicit refresh is usually not needed.
    };

    return { data, loading, error, refresh, runScan };
}
