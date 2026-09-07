import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { theme } from '../../theme/colors';

export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Approved! 🎉</Text>
        <Text style={styles.subtitle}>You're a verified driver. The home with available rides comes next.</Text>
        <TouchableOpacity style={styles.button} onPress={() => supabase.auth.signOut()}>
          <Text style={styles.buttonText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  title: { fontSize: 28, fontWeight: '800', color: theme.text, marginBottom: 12 },
  subtitle: { fontSize: 15, color: theme.textMuted, textAlign: 'center', marginBottom: 32 },
  button: { backgroundColor: theme.dangerFaint, borderWidth: 1, borderColor: 'rgba(255,71,87,0.25)', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  buttonText: { color: theme.danger, fontWeight: '700', fontSize: 15 },
});
