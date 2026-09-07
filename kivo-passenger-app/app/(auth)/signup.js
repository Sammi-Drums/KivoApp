import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import PasswordInput, { isPasswordStrongEnough } from '../../components/PasswordInput';
import { theme } from '../../theme/colors';

export default function SignupScreen() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignup = async () => {
    if (!fullName.trim() || !phone.trim() || !email.trim() || !password) {
      Alert.alert('Missing info', 'Please fill in all fields.');
      return;
    }
    if (!isPasswordStrongEnough(password)) {
      Alert.alert('Weak password', 'Use at least 8 characters and avoid common passwords.');
      return;
    }
    setLoading(true);
    try {
      // 1. Create auth account
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim(), password,
        options: { data: { full_name: fullName, role: 'passenger' } },
      });
      if (authError) throw authError;
      if (!authData.user) throw new Error('Signup failed.');

      const userId = authData.user.id;
      const username = fullName.toLowerCase().replace(/\s+/g, '.') + '.' + Date.now().toString().slice(-4);

      // 2. Create users row
      const { error: userError } = await supabase.from('users').insert({
        id: userId, username, password_hash: 'managed_by_supabase_auth',
        email: email.trim(), phone_number: phone, role: 'passenger', status: 'active',
      });
      if (userError) throw userError;

      // 3. Create passenger row
      const { error: pError } = await supabase.from('passengers').insert({
        user_id: userId, full_name: fullName, preferred_payment_method: 'cash',
      });
      if (pError) throw pError;

      // 4. Create wallet
      await supabase.from('wallets').insert({ user_id: userId, balance: 0 });

      // Success — root layout auto-redirects to app
    } catch (err) {
      await supabase.auth.signOut();
      Alert.alert('Signup failed', err.message);
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <TouchableOpacity style={styles.back} onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="chevron-back" size={24} color={theme.textMuted} />
          </TouchableOpacity>

          <Text style={styles.title}>Create account</Text>
          <Text style={styles.subtitle}>Join Kivo Rides to start booking</Text>

          <Field label="FULL NAME" value={fullName} onChangeText={setFullName} placeholder="e.g. Marie Nkeng" editable={!loading} />
          <Field label="PHONE NUMBER" value={phone} onChangeText={setPhone} placeholder="+237 6XX XXX XXX" keyboardType="phone-pad" editable={!loading} />
          <Field label="EMAIL" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" editable={!loading} />

          <View style={styles.field}>
            <Text style={styles.label}>PASSWORD</Text>
            <PasswordInput value={password} onChangeText={setPassword} placeholder="At least 8 characters" showStrength editable={!loading} />
          </View>

          <TouchableOpacity style={[styles.button, loading && { opacity: 0.6 }]} onPress={handleSignup} disabled={loading} activeOpacity={0.85}>
            {loading ? <ActivityIndicator color={theme.onPrimary} /> : <><Text style={styles.buttonText}>Create Account</Text><Ionicons name="arrow-forward" size={18} color={theme.onPrimary} /></>}
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account?</Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
              <Text style={styles.footerLink}>Sign in</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({ label, ...props }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput style={styles.input} placeholderTextColor={theme.textFaint} {...props} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  scroll: { flexGrow: 1, padding: 24, paddingBottom: 60 },
  back: { alignSelf: 'flex-start', padding: 8, marginBottom: 12 },
  title: { fontSize: 24, fontWeight: '800', color: theme.text, marginBottom: 6 },
  subtitle: { fontSize: 14, color: theme.textMuted, marginBottom: 24 },
  field: { marginBottom: 16 },
  label: { fontSize: 11, fontWeight: '700', color: theme.textMuted, marginBottom: 8, letterSpacing: 0.5 },
  input: { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.borderStrong, borderRadius: 12, padding: 16, color: theme.text, fontSize: 15 },
  button: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, backgroundColor: theme.primary, padding: 16, borderRadius: 12, marginTop: 8 },
  buttonText: { color: theme.onPrimary, fontSize: 15, fontWeight: '700' },
  footer: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 24 },
  footerText: { color: theme.textMuted, fontSize: 14 },
  footerLink: { color: theme.primary, fontSize: 14, fontWeight: '700' },
});
