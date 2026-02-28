import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Modal,
} from 'react-native';
import { createApiClient } from '@mission-control/api';
import { PRIORITY_CONFIG, colors } from '@mission-control/types';
import type { Task } from '@mission-control/types';

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001';
const apiClient = createApiClient({
  baseUrl: API_BASE,
  getAuthToken: () => null,
});

const STATUS_COLS = [
  { key: 'todo', label: 'To Do', icon: '📋', color: '#60a5fa' },
  { key: 'in_progress', label: 'In Progress', icon: '🔨', color: '#fbbf24' },
  { key: 'done', label: 'Done', icon: '✅', color: '#34d399' },
] as const;

const PRIORITY_OPTIONS = ['high', 'medium', 'low'] as const;

export default function TasksScreen() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('');

  // Create form
  const [newTitle, setNewTitle] = useState('');
  const [newProject, setNewProject] = useState('');
  const [newPriority, setNewPriority] = useState<'high' | 'medium' | 'low'>('medium');
  const [submitting, setSubmitting] = useState(false);

  const loadTasks = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const result = await apiClient.tasks.list(filterStatus ? { status: filterStatus } : undefined);
      setTasks(result);
    } catch (err) {
      console.error('Failed to load tasks:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filterStatus]);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    setSubmitting(true);
    try {
      await apiClient.tasks.create({
        title: newTitle.trim(),
        projectPath: newProject.trim() || 'general',
        priority: newPriority,
        effort: 'M',
        taskType: 'feature',
      });
      setNewTitle('');
      setNewProject('');
      setShowCreate(false);
      await loadTasks();
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to create task');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (id: string, status: string) => {
    try {
      await apiClient.tasks.update(id, { status });
      setTasks(prev => prev.map(t => t.id === id ? { ...t, status: status as Task['status'] } : t));
    } catch (err) {
      console.error('Failed to update task:', err);
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete Task', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await apiClient.tasks.delete(id);
            setTasks(prev => prev.filter(t => t.id !== id));
          } catch (err) {
            console.error('Failed to delete task:', err);
          }
        },
      },
    ]);
  };

  const filtered = filterStatus ? tasks.filter(t => t.status === filterStatus) : tasks;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>📋 Tasks</Text>
          <TouchableOpacity style={styles.addBtn} onPress={() => setShowCreate(true)}>
            <Text style={styles.addBtnText}>+ New</Text>
          </TouchableOpacity>
        </View>

        {/* Status filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
          <TouchableOpacity
            style={[styles.filterChip, !filterStatus && styles.filterChipActive]}
            onPress={() => setFilterStatus('')}
          >
            <Text style={[styles.filterChipText, !filterStatus && styles.filterChipTextActive]}>All</Text>
          </TouchableOpacity>
          {STATUS_COLS.map(col => (
            <TouchableOpacity
              key={col.key}
              style={[styles.filterChip, filterStatus === col.key && styles.filterChipActive]}
              onPress={() => setFilterStatus(filterStatus === col.key ? '' : col.key)}
            >
              <Text style={[styles.filterChipText, filterStatus === col.key && styles.filterChipTextActive]}>
                {col.icon} {col.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Task List */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : (
        <ScrollView
          style={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => loadTasks(true)} tintColor={colors.accent} />
          }
        >
          {filtered.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>📋</Text>
              <Text style={styles.emptyText}>No tasks yet</Text>
              <TouchableOpacity style={styles.emptyBtn} onPress={() => setShowCreate(true)}>
                <Text style={styles.emptyBtnText}>Create your first task</Text>
              </TouchableOpacity>
            </View>
          ) : (
            filtered.map(task => {
              const priCfg = PRIORITY_CONFIG[task.priority as keyof typeof PRIORITY_CONFIG];
              const statusCol = STATUS_COLS.find(c => c.key === task.status);
              return (
                <View key={task.id} style={styles.taskItem}>
                  <TouchableOpacity
                    style={[
                      styles.taskCheckbox,
                      { borderColor: statusCol?.color ?? colors.border },
                      task.status === 'done' && { backgroundColor: '#34d399' },
                    ]}
                    onPress={() => {
                      const next = task.status === 'done' ? 'todo' : task.status === 'todo' ? 'in_progress' : 'done';
                      handleStatusChange(task.id, next);
                    }}
                  >
                    {task.status === 'done' && <Text style={styles.checkMark}>✓</Text>}
                  </TouchableOpacity>

                  <View style={styles.taskContent}>
                    <Text
                      style={[
                        styles.taskTitle,
                        task.status === 'done' && styles.taskDone,
                      ]}
                      numberOfLines={2}
                    >
                      {task.title}
                    </Text>
                    <Text style={styles.taskMeta}>{task.projectPath} · {task.taskType}</Text>
                  </View>

                  <View style={styles.taskRight}>
                    {priCfg && (
                      <Text style={[styles.priorityBadge, { color: priCfg.color }]}>
                        {priCfg.label}
                      </Text>
                    )}
                    <TouchableOpacity onPress={() => handleDelete(task.id)} style={styles.deleteBtn}>
                      <Text style={styles.deleteBtnText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      )}

      {/* Create Modal */}
      <Modal visible={showCreate} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>New Task</Text>

            <Text style={styles.fieldLabel}>Title *</Text>
            <TextInput
              style={styles.input}
              placeholder="What needs to be done?"
              placeholderTextColor={colors.textTertiary}
              value={newTitle}
              onChangeText={setNewTitle}
              autoFocus
            />

            <Text style={styles.fieldLabel}>Project</Text>
            <TextInput
              style={styles.input}
              placeholder="Project path (optional)"
              placeholderTextColor={colors.textTertiary}
              value={newProject}
              onChangeText={setNewProject}
            />

            <Text style={styles.fieldLabel}>Priority</Text>
            <View style={styles.priorityRow}>
              {PRIORITY_OPTIONS.map(p => {
                const cfg = PRIORITY_CONFIG[p];
                return (
                  <TouchableOpacity
                    key={p}
                    style={[
                      styles.priorityChip,
                      newPriority === p && { backgroundColor: cfg.color + '20', borderColor: cfg.color },
                    ]}
                    onPress={() => setNewPriority(p)}
                  >
                    <Text style={[styles.priorityChipText, newPriority === p && { color: cfg.color }]}>
                      {cfg.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowCreate(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.createBtn, (!newTitle.trim() || submitting) && styles.createBtnDisabled]}
                onPress={handleCreate}
                disabled={!newTitle.trim() || submitting}
              >
                <Text style={styles.createBtnText}>{submitting ? 'Creating…' : 'Create Task'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgPrimary },
  header: { backgroundColor: colors.bgSecondary, paddingTop: 60, paddingBottom: 12, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 22, fontWeight: '800', color: colors.textPrimary },
  addBtn: { backgroundColor: colors.accent, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  addBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  filterRow: { marginBottom: 4 },
  filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', marginRight: 8, backgroundColor: 'rgba(255,255,255,0.03)' },
  filterChipActive: { backgroundColor: colors.accent + '20', borderColor: colors.accent },
  filterChipText: { fontSize: 12, color: colors.textSecondary },
  filterChipTextActive: { color: colors.accent, fontWeight: '600' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { flex: 1 },
  empty: { alignItems: 'center', padding: 48 },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyText: { color: colors.textSecondary, fontSize: 16, marginBottom: 16 },
  emptyBtn: { backgroundColor: colors.accent, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  emptyBtnText: { color: '#fff', fontWeight: '600' },
  taskItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' },
  taskCheckbox: { width: 22, height: 22, borderRadius: 5, borderWidth: 2, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  checkMark: { color: '#fff', fontSize: 12, fontWeight: '700' },
  taskContent: { flex: 1, minWidth: 0 },
  taskTitle: { fontSize: 14, fontWeight: '500', color: colors.textPrimary },
  taskDone: { textDecorationLine: 'line-through', opacity: 0.5 },
  taskMeta: { fontSize: 11, color: colors.textTertiary, marginTop: 2 },
  taskRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  priorityBadge: { fontSize: 10, fontWeight: '600' },
  deleteBtn: { padding: 4 },
  deleteBtnText: { color: colors.textTertiary, fontSize: 14 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  modalSheet: { backgroundColor: colors.bgSecondary, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 48 },
  modalHandle: { width: 36, height: 4, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: colors.textPrimary, marginBottom: 20 },
  fieldLabel: { fontSize: 11, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  input: { backgroundColor: colors.bgPrimary, color: colors.textPrimary, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: 12, fontSize: 15, marginBottom: 16 },
  priorityRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  priorityChip: { flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', alignItems: 'center' },
  priorityChipText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  modalActions: { flexDirection: 'row', gap: 12 },
  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center' },
  cancelBtnText: { color: colors.textSecondary, fontWeight: '600' },
  createBtn: { flex: 2, paddingVertical: 14, borderRadius: 12, backgroundColor: colors.accent, alignItems: 'center' },
  createBtnDisabled: { opacity: 0.4 },
  createBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
