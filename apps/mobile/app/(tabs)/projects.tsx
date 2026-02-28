import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { createApiClient } from '@mission-control/api';
import { TIER_CONFIG, PRIORITY_CONFIG, colors } from '@mission-control/types';
import type { Project, StatusData } from '@mission-control/types';

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001';
const apiClient = createApiClient({ baseUrl: API_BASE, getAuthToken: () => null });

export default function ProjectsScreen() {
  const [data, setData] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [filterTier, setFilterTier] = useState('');

  const load = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const result = await apiClient.projects.list();
      setData(result);
    } catch (err) {
      console.error('Failed to load projects:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, []);

  const allProjects = data?.projects ?? [];
  const filtered = allProjects.filter(p => {
    if (filterTier && p.tier !== filterTier) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>📁 Projects</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search projects..."
          placeholderTextColor={colors.textTertiary}
          value={search}
          onChangeText={setSearch}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
          <TouchableOpacity
            style={[styles.chip, !filterTier && styles.chipActive]}
            onPress={() => setFilterTier('')}
          >
            <Text style={[styles.chipText, !filterTier && styles.chipTextActive]}>All</Text>
          </TouchableOpacity>
          {(['building', 'shipped', 'prototype', 'idea', 'maintaining', 'archived'] as const).map(tier => {
            const cfg = TIER_CONFIG[tier];
            return (
              <TouchableOpacity
                key={tier}
                style={[styles.chip, filterTier === tier && styles.chipActive]}
                onPress={() => setFilterTier(filterTier === tier ? '' : tier)}
              >
                <Text style={[styles.chipText, filterTier === tier && { color: cfg.color }]}>
                  {cfg.emoji} {cfg.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : (
        <ScrollView
          style={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.accent} />
          }
        >
          <Text style={styles.resultCount}>{filtered.length} projects</Text>
          {filtered.map(project => (
            <ProjectCard key={project.path} project={project} />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function ProjectCard({ project }: { project: Project }) {
  const tierCfg = TIER_CONFIG[project.tier as keyof typeof TIER_CONFIG];
  const priCfg = PRIORITY_CONFIG[project.priority as keyof typeof PRIORITY_CONFIG];

  return (
    <TouchableOpacity style={styles.projectCard} activeOpacity={0.7}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardName} numberOfLines={1}>{project.name}</Text>
        {tierCfg && (
          <Text style={[styles.tierBadge, { color: tierCfg.color, backgroundColor: tierCfg.bg }]}>
            {tierCfg.emoji} {tierCfg.label}
          </Text>
        )}
      </View>
      {project.description ? (
        <Text style={styles.cardDesc} numberOfLines={2}>{project.description}</Text>
      ) : null}
      <View style={styles.cardFooter}>
        <Text style={styles.cardPath}>{project.path}</Text>
        <View style={styles.cardRight}>
          {priCfg && (
            <Text style={[styles.priBadge, { color: priCfg.color }]}>
              {priCfg.label}
            </Text>
          )}
          {project.oss && <Text style={styles.ossBadge}>OSS</Text>}
        </View>
      </View>
      {project.stack.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
          {project.stack.slice(0, 6).map(tech => (
            <Text key={tech} style={styles.stackTag}>{tech}</Text>
          ))}
        </ScrollView>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgPrimary },
  header: { backgroundColor: colors.bgSecondary, paddingTop: 60, paddingBottom: 12, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)', gap: 10 },
  title: { fontSize: 22, fontWeight: '800', color: colors.textPrimary },
  searchInput: { backgroundColor: colors.bgPrimary, color: colors.textPrimary, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: 10, fontSize: 14 },
  filterRow: {},
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', marginRight: 8, backgroundColor: 'rgba(255,255,255,0.03)' },
  chipActive: { backgroundColor: colors.accent + '20', borderColor: colors.accent },
  chipText: { fontSize: 12, color: colors.textSecondary },
  chipTextActive: { color: colors.accent, fontWeight: '600' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { flex: 1, padding: 16 },
  resultCount: { fontSize: 11, color: colors.textTertiary, marginBottom: 12, textTransform: 'uppercase' },
  projectCard: { backgroundColor: colors.bgSecondary, borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  cardName: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, flex: 1, marginRight: 8 },
  tierBadge: { fontSize: 10, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  cardDesc: { fontSize: 12, color: colors.textSecondary, lineHeight: 17, marginBottom: 6 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardPath: { fontSize: 10, color: colors.textTertiary, fontFamily: 'monospace', flex: 1 },
  cardRight: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  priBadge: { fontSize: 10, fontWeight: '600' },
  ossBadge: { fontSize: 9, fontWeight: '700', color: '#34d399', backgroundColor: 'rgba(52,211,153,0.12)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  stackTag: { fontSize: 10, color: colors.textSecondary, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, marginRight: 4 },
});
