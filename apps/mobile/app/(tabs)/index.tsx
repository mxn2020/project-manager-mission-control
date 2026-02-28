import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { createApiClient } from '@mission-control/api';
import { TIER_CONFIG, PRIORITY_CONFIG, colors } from '@mission-control/types';
import type { StatusData } from '@mission-control/types';

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001';

const apiClient = createApiClient({
  baseUrl: API_BASE,
  getAuthToken: () => null, // TODO: integrate with auth store
});

export default function DashboardScreen() {
  const [data, setData] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const result = await apiClient.projects.list();
      setData(result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.loadingText}>Loading Mission Control...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorIcon}>⚠️</Text>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => load()}>
          <Text style={styles.retryBtnText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const tierCounts = data?.summary.by_tier ?? {};
  const activeTiers = Object.entries(tierCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  const topProjects = (data?.projects ?? [])
    .filter(p => p.tier === 'building' || p.tier === 'prototype')
    .sort((a, b) => {
      const order: Record<string, number> = { high: 0, medium: 1, low: 2, parked: 3 };
      return (order[a.priority] ?? 9) - (order[b.priority] ?? 9);
    })
    .slice(0, 5);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.accent} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.logo}>🚀 Mission Control</Text>
        <Text style={styles.subtitle}>
          {data?.total_projects ?? 0} projects tracked
        </Text>
      </View>

      {/* Stats Row */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.statsRow}>
        {[
          { label: 'Total', value: data?.total_projects ?? 0, color: colors.accent },
          { label: 'Building', value: tierCounts['building'] ?? 0, color: TIER_CONFIG.building.color },
          { label: 'Shipped', value: tierCounts['shipped'] ?? 0, color: TIER_CONFIG.shipped.color },
          { label: 'Ideas', value: tierCounts['idea'] ?? 0, color: TIER_CONFIG.idea.color },
        ].map(stat => (
          <View key={stat.label} style={[styles.statCard, { borderLeftColor: stat.color }]}>
            <Text style={[styles.statValue, { color: stat.color }]}>{stat.value}</Text>
            <Text style={styles.statLabel}>{stat.label}</Text>
          </View>
        ))}
      </ScrollView>

      {/* Active Projects */}
      {topProjects.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🏗️ Active Projects</Text>
          {topProjects.map(project => {
            const priorityCfg = PRIORITY_CONFIG[project.priority as keyof typeof PRIORITY_CONFIG];
            const tierCfg = TIER_CONFIG[project.tier as keyof typeof TIER_CONFIG];
            return (
              <View key={project.path} style={styles.projectCard}>
                <View style={styles.projectCardHeader}>
                  <Text style={styles.projectName}>{project.name}</Text>
                  {tierCfg && (
                    <Text style={[styles.badge, { color: tierCfg.color, backgroundColor: tierCfg.bg }]}>
                      {tierCfg.emoji} {tierCfg.label}
                    </Text>
                  )}
                </View>
                {project.description ? (
                  <Text style={styles.projectDesc} numberOfLines={2}>{project.description}</Text>
                ) : null}
                <View style={styles.projectMeta}>
                  <Text style={styles.projectPath}>{project.path}</Text>
                  {priorityCfg && (
                    <Text style={[styles.priorityBadge, { color: priorityCfg.color }]}>
                      {priorityCfg.label}
                    </Text>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Tier Distribution */}
      {activeTiers.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📊 By Stage</Text>
          {activeTiers.map(([tier, count]) => {
            const cfg = TIER_CONFIG[tier as keyof typeof TIER_CONFIG];
            const pct = data ? (count / data.total_projects) * 100 : 0;
            return (
              <View key={tier} style={styles.barRow}>
                <Text style={styles.barLabel}>
                  {cfg?.emoji ?? '•'} {cfg?.label ?? tier}
                </Text>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.barFill,
                      { width: `${Math.max(pct, 4)}%`, backgroundColor: cfg?.color ?? colors.accent },
                    ]}
                  />
                </View>
                <Text style={[styles.barCount, { color: cfg?.color ?? colors.accent }]}>{count}</Text>
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgPrimary },
  content: { padding: 20, paddingTop: 60 },
  centered: { flex: 1, backgroundColor: colors.bgPrimary, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { color: colors.textSecondary, marginTop: 12 },
  errorIcon: { fontSize: 40 },
  errorText: { color: colors.error, textAlign: 'center', paddingHorizontal: 32 },
  retryBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 8,
  },
  retryBtnText: { color: '#fff', fontWeight: '600' },
  header: { marginBottom: 24 },
  logo: { fontSize: 24, fontWeight: '800', color: colors.accent },
  subtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
  statsRow: { marginBottom: 24, marginHorizontal: -20 },
  statCard: {
    backgroundColor: colors.bgSecondary,
    borderLeftWidth: 3,
    borderRadius: 10,
    padding: 16,
    marginLeft: 16,
    minWidth: 100,
    marginBottom: 4,
  },
  statValue: { fontSize: 28, fontWeight: '800' },
  statLabel: { fontSize: 11, color: colors.textSecondary, marginTop: 2, textTransform: 'uppercase' },
  section: { marginBottom: 28 },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    opacity: 0.7,
  },
  projectCard: {
    backgroundColor: colors.bgSecondary,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  projectCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  projectName: { fontSize: 14, fontWeight: '700', color: colors.textPrimary, flex: 1, marginRight: 8 },
  badge: {
    fontSize: 10,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  projectDesc: { fontSize: 12, color: colors.textSecondary, lineHeight: 17, marginBottom: 8 },
  projectMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  projectPath: { fontSize: 10, color: colors.textTertiary, fontFamily: 'monospace', flex: 1 },
  priorityBadge: { fontSize: 10, fontWeight: '600' },
  barRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
  barLabel: { width: 90, fontSize: 12, color: colors.textSecondary },
  barTrack: {
    flex: 1,
    height: 20,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: 4 },
  barCount: { width: 28, fontSize: 12, fontWeight: '700', textAlign: 'right' },
});
