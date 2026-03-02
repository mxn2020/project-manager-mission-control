import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { colors } from '@mission-control/types';

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

const WELCOME_MSG: Message = {
  id: 'welcome',
  role: 'assistant',
  content: `👋 Hi! I'm your **Mission Control AI** assistant.

I can query, create, and update your project data directly from your Minions database. Try asking me:

• "How many shipped projects do I have?"
• "List all projects using React"
• "What's the health score of mega-claw?"
• "Give me a portfolio summary"`,
};

export default function AIScreen() {
  const [messages, setMessages] = useState<Message[]>([WELCOME_MSG]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [messages, sending]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: text,
    };

    const currentMessages = messages.filter((m) => m.id !== 'welcome');
    const newChatHistory = [...currentMessages, userMsg];

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setSending(true);

    try {
      // 1. Prepare history payload for API 
      const historyPayload = newChatHistory.slice(-10).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      // 2. Transmit to Express `/api/ai/chat` Backend
      const res = await fetch(`${API_BASE}/api/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: historyPayload, sessionId: 'mobile-session' }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();

      const replyMsg: Message = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: data.response,
      };

      setMessages((prev) => [...prev, replyMsg]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `e-${Date.now()}`,
          role: 'assistant',
          content: `❌ Error connecting to Minions API: ${err.message}`,
        },
      ]);
    } finally {
      setSending(false);
    }
  }, [input, sending, messages]);

  const renderContent = (text: string) => {
    // Quick basic text-parsing for bold and lists on React Native Text nodes
    const lines = text.split('\n');
    return lines.map((line, i) => {
      if (!line) return <Text key={i} style={styles.emptyLine}> </Text>;

      const isListItem = line.startsWith('•') || line.startsWith('-');
      let formattedLine = isListItem ? line.substring(1).trim() : line;

      // Handle basic inline bold markers **text**
      const parts = formattedLine.split(/(\*\*.*?\*\*)/g);

      return (
        <View key={i} style={[styles.textLine, isListItem && styles.listItem]}>
          {isListItem && <Text style={styles.bulletPoint}>•</Text>}
          <Text style={styles.messageText}>
            {parts.map((part, j) => {
              if (part.startsWith('**') && part.endsWith('**')) {
                return (
                  <Text key={j} style={styles.boldText}>
                    {part.slice(2, -2)}
                  </Text>
                );
              }
              return <Text key={j}>{part}</Text>;
            })}
          </Text>
        </View>
      );
    });
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View style={styles.header}>
        <Text style={styles.title}>🤖 AI Assistant</Text>
        <Text style={styles.subtitle}>Powered by local Minions engine</Text>
      </View>

      <ScrollView
        ref={scrollViewRef}
        style={styles.chatList}
        contentContainerStyle={styles.chatContent}
      >
        {messages.map((msg) => (
          <View
            key={msg.id}
            style={[
              styles.messageBubble,
              msg.role === 'user' ? styles.userBubble : styles.assistantBubble,
            ]}
          >
            <View style={styles.messageHeader}>
              <Text style={styles.messageAvatar}>
                {msg.role === 'user' ? '👤' : '🤖'}
              </Text>
              <Text style={styles.messageRole}>
                {msg.role === 'user' ? 'You' : 'Mission Control'}
              </Text>
            </View>
            <View style={styles.messageBody}>{renderContent(msg.content)}</View>
          </View>
        ))}

        {sending && (
          <View style={[styles.messageBubble, styles.assistantBubble]}>
            <View style={styles.messageHeader}>
              <Text style={styles.messageAvatar}>🤖</Text>
              <Text style={styles.messageRole}>Mission Control</Text>
            </View>
            <View style={styles.thinkingContainer}>
              <ActivityIndicator size="small" color={colors.accent} />
              <Text style={styles.thinkingText}>Thinking...</Text>
            </View>
          </View>
        )}
      </ScrollView>

      <View style={styles.inputArea}>
        <TextInput
          style={styles.textInput}
          placeholder="Ask about your workspace..."
          placeholderTextColor={colors.textTertiary}
          value={input}
          onChangeText={setInput}
          multiline
          maxLength={500}
        />
        <TouchableOpacity
          style={[styles.sendButton, (!input.trim() || sending) && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!input.trim() || sending}
        >
          <Text style={styles.sendButtonText}>↑</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgPrimary },
  header: {
    paddingTop: 60,
    paddingBottom: 15,
    paddingHorizontal: 20,
    backgroundColor: colors.bgSecondary,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  title: { fontSize: 22, fontWeight: '800', color: colors.textPrimary },
  subtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },

  chatList: { flex: 1 },
  chatContent: { padding: 16, gap: 16, paddingBottom: 32 },

  messageBubble: {
    maxWidth: '90%',
    padding: 16,
    borderRadius: 16,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: colors.accent + '30', // Deep accent opacity
    borderWidth: 1,
    borderColor: colors.accent,
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    alignSelf: 'flex-start',
    backgroundColor: colors.bgSecondary,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderBottomLeftRadius: 4,
  },

  messageHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  messageAvatar: { fontSize: 16 },
  messageRole: { fontSize: 12, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase' },

  messageBody: { gap: 4 },
  emptyLine: { height: 10 },
  textLine: { flexDirection: 'row', flexWrap: 'wrap' },
  listItem: { paddingLeft: 8 },
  bulletPoint: { color: colors.textPrimary, marginRight: 6, fontSize: 14, fontWeight: '800', marginTop: 2 },
  messageText: { fontSize: 15, color: colors.textPrimary, lineHeight: 22, flexShrink: 1 },
  boldText: { fontWeight: '700', color: colors.accent },

  thinkingContainer: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  thinkingText: { color: colors.textSecondary, fontSize: 14, fontStyle: 'italic' },

  inputArea: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
    backgroundColor: colors.bgSecondary,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    gap: 12,
  },
  textInput: {
    flex: 1,
    backgroundColor: colors.bgPrimary,
    color: colors.textPrimary,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    fontSize: 15,
    minHeight: 45,
    maxHeight: 120,
  },
  sendButton: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: { opacity: 0.5 },
  sendButtonText: { color: '#fff', fontSize: 20, fontWeight: '800', marginBottom: 2 },
});
