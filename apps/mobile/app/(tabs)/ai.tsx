import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { colors } from '@mission-control/types';

export default function AIScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>🤖 AI Assistant</Text>
        <Text style={styles.subtitle}>Connect to the Mission Control server to use AI features</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Getting Started</Text>
        <Text style={styles.cardText}>
          The AI assistant requires the Mission Control server to be running. Set up your API URL in the app settings.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Features</Text>
        {[
          '💬 Chat with AI about your projects',
          '📊 Analyze project health',
          '🔧 Get architecture recommendations',
          '📝 Generate documentation',
          '🚀 Plan next actions',
        ].map(feature => (
          <View key={feature} style={styles.featureRow}>
            <Text style={styles.featureText}>{feature}</Text>
          </View>
        ))}
      </View>

      <TouchableOpacity
        style={styles.webBtn}
        onPress={() => Linking.openURL('http://localhost:5190/ai')}
      >
        <Text style={styles.webBtnText}>Open in Web App ↗</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgPrimary },
  content: { padding: 20, paddingTop: 60, gap: 16 },
  header: { marginBottom: 8 },
  title: { fontSize: 24, fontWeight: '800', color: colors.textPrimary },
  subtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 4, lineHeight: 18 },
  card: { backgroundColor: colors.bgSecondary, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  cardTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary, marginBottom: 8 },
  cardText: { fontSize: 13, color: colors.textSecondary, lineHeight: 19 },
  featureRow: { paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' },
  featureText: { fontSize: 13, color: colors.textSecondary },
  webBtn: { backgroundColor: colors.accent, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 8 },
  webBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
