import { View, StyleSheet } from 'react-native';

export default function TabBarBackground() {
  return <View style={styles.bg} />;
}

const styles = StyleSheet.create({
  bg: {
    flex: 1,
    backgroundColor: '#12141f',
  },
});
