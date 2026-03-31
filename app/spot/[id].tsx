import { View, Text, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SpotDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.placeholder}>
        <Text style={styles.title}>Fiche Aire</Text>
        <Text style={styles.subtitle}>ID : {id}</Text>
        <Text style={styles.subtitle}>Détail complet — Phase 5</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F6F0' },
  placeholder: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  title: { fontSize: 24, fontWeight: '700', color: '#2D6A4F' },
  subtitle: { fontSize: 14, color: '#7A8A7A' },
});
