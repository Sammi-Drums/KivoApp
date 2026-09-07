import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import PasswordInput from '../../components/PasswordInput';
import { theme } from '../../theme/colors';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Missing info', 'Please enter your email and password.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (error) Alert.alert('Login failed', 'Invalid email or password.');
    // On success, root layout auto-redirects
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.brand}>
            <View style={styles.logo}><Text style={styles.logoText}>KR</Text></View>
            <Text style={styles.brandText}>Kivo <Text style={{ color: theme.primary }}>Rides</Text></Text>
          </View>

          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>Sign in to book your ride</Text>

          <View style={styles.field}>
            <Text style={styles.label}>EMAIL</Text>
            <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="you@example.com"
              placeholderTextColor={theme.textFaint} keyboardType="email-address" autoCapitalize="none" editable={!loading} />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>PASSWORD</Text>
            <PasswordInput value={password} onChangeText={setPassword} editable={!loading} />
          </View>

          <TouchableOpacity style={[styles.button, loading && { opacity: 0.6 }]} onPress={handleLogin} disabled={loading} activeOpacity={0.85}>
            {loading ? <ActivityIndicator color={theme.onPrimary} /> : <><Text style={styles.buttonText}>Sign In</Text><Ionicons name="arrow-forward" size={18} color={theme.onPrimary} /></>}
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Don't have an account?</Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/signup')}>
              <Text style={styles.footerLink}>Create one</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  brand: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 40 },
  logo: { width: 44, height: 44, borderRadius: 12, backgroundColor: theme.primary, justifyContent: 'center', alignItems: 'center' },
  logoText: { color: '#000', fontWeight: '800', fontSize: 16 },
  brandText: { fontSize: 26, fontWeight: '800', color: theme.text },
  title: { fontSize: 24, fontWeight: '800', color: theme.text, marginBottom: 6 },
  subtitle: { fontSize: 14, color: theme.textMuted, marginBottom: 28 },
  field: { marginBottom: 18 },
  label: { fontSize: 11, fontWeight: '700', color: theme.textMuted, marginBottom: 8, letterSpacing: 0.5 },
  input: { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.borderStrong, borderRadius: 12, padding: 16, color: theme.text, fontSize: 15 },
  button: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, backgroundColor: theme.primary, padding: 16, borderRadius: 12, marginTop: 8 },
  buttonText: { color: theme.onPrimary, fontSize: 15, fontWeight: '700' },
  footer: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 24 },
  footerText: { color: theme.textMuted, fontSize: 14 },
  footerLink: { color: theme.primary, fontSize: 14, fontWeight: '700' },
});
