import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { theme } from '../../theme/colors';

export default function ProfileScreen() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: p } = await supabase.from('passengers')
        .select('full_name, preferred_payment_method, user:users(email, phone_number)')
        .eq('user_id', user.id).maybeSingle();
      const { data: w } = await supabase.from('wallets').select('balance').eq('user_id', user.id).maybeSingle();
      setProfile({ ...p, balance: w?.balance || 0, email: user.email });
      setLoading(false);
    }
    load();
  }, []);

  const handleLogout = () => {
    Alert.alert('Sign out?', 'You will need to sign in again.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => supabase.auth.signOut() },
    ]);
  };

  if (loading || !profile) {
    return <SafeAreaView style={styles.container}><View style={styles.center}><ActivityIndicator size="large" color={theme.primary} /></View></SafeAreaView>;
  }

  const initials = (profile.full_name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  const payLabel = { cash: '💵 Cash', mobile_money: '📱 Mobile Money', card: '💳 Card' };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Profile</Text>

        <View style={styles.card}>
          <View style={styles.avatar}><Text style={styles.avatarText}>{initials}</Text></View>
          <Text style={styles.name}>{profile.full_name}</Text>
          <Text style={styles.email}>{profile.email}</Text>
        </View>

        <View style={styles.walletCard}>
          <Text style={styles.walletLabel}>WALLET BALANCE</Text>
          <Text style={styles.walletAmount}>{Number(profile.balance).toLocaleString()} <Text style={styles.walletCurrency}>FCFA</Text></Text>
        </View>

        <View style={styles.section}>
          <Row icon="call-outline" label="Phone" value={profile.user?.phone_number || '—'} />
          <Row icon="card-outline" label="Payment" value={payLabel[profile.preferred_payment_method] || 'Cash'} last />
        </View>

        <TouchableOpacity style={styles.signOut} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={18} color={theme.danger} />
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ icon, label, value, last }) {
  return (
    <View style={[styles.row, !last && styles.rowBorder]}>
      <View style={styles.rowIcon}><Ionicons name={icon} size={18} color={theme.textMuted} /></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 26, fontWeight: '800', color: theme.text, marginTop: 8, marginBottom: 20 },
  card: { backgroundColor: theme.surface, borderRadius: 16, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: theme.border, marginBottom: 16 },
  avatar: { width: 88, height: 88, borderRadius: 44, backgroundColor: theme.primary, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  avatarText: { color: '#000', fontWeight: '800', fontSize: 32 },
  name: { fontSize: 18, fontWeight: '700', color: theme.text },
  email: { fontSize: 13, color: theme.textMuted, marginTop: 4 },
  walletCard: { backgroundColor: theme.surface, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: theme.primaryBorder, marginBottom: 16 },
  walletLabel: { fontSize: 11, fontWeight: '700', color: theme.textMuted, letterSpacing: 1, marginBottom: 8 },
  walletAmount: { fontSize: 30, fontWeight: '800', color: theme.primary },
  walletCurrency: { fontSize: 14, color: theme.textMuted },
  section: { backgroundColor: theme.surface, borderRadius: 16, borderWidth: 1, borderColor: theme.border, marginBottom: 24, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: theme.divider },
  rowIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.05)', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  rowLabel: { fontSize: 11, fontWeight: '700', color: theme.textMuted, letterSpacing: 0.5 },
  rowValue: { fontSize: 15, color: theme.text, marginTop: 2 },
  signOut: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, backgroundColor: theme.dangerFaint, borderWidth: 1, borderColor: 'rgba(255,71,87,0.25)', padding: 16, borderRadius: 12 },
  signOutText: { color: theme.danger, fontSize: 15, fontWeight: '700' },
});
