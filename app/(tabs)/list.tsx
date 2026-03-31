import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ListScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.placeholder}>
        <Text style={styles.title}>📋 Liste</Text>
        <Text style={styles.subtitle}>Aires triées par proximité — Phase 4</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F6F0' },
  placeholder: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  title: { fontSize: 28, fontWeight: '700', color: '#2D6A4F' },
  subtitle: { fontSize: 14, color: '#7A8A7A' },
});
