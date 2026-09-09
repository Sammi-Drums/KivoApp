import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { theme } from '../../theme/colors';
import { DRIVER_CATEGORIES } from '../../lib/tiers';

export default function ProfileScreen() {
  const [driver, setDriver] = useState(null);
  const [vehicle, setVehicle] = useState(null);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: d } = await supabase.from('drivers')
        .select('full_name, phone_number, email, driver_category, driver_license_no, city:cities(city_name), vehicles(vehicle_type, plate_number, brand, model, color)')
        .eq('user_id', user.id).maybeSingle();
      setDriver(d);
      setVehicle(d?.vehicles?.[0] || null);
      const { data: w } = await supabase.from('wallets').select('balance').eq('user_id', user.id).maybeSingle();
      setBalance(w?.balance || 0);
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

  if (loading || !driver) {
    return <SafeAreaView style={styles.container}><View style={styles.center}><ActivityIndicator size="large" color={theme.primary} /></View></SafeAreaView>;
  }

  const initials = (driver.full_name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  const catLabel = DRIVER_CATEGORIES[driver.driver_category]?.label || 'Driver';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Profile</Text>

        <View style={styles.card}>
          <View style={styles.avatar}><Text style={styles.avatarText}>{initials}</Text></View>
          <Text style={styles.name}>{driver.full_name}</Text>
          <Text style={styles.email}>{driver.email}</Text>
          <View style={styles.catBadge}><Text style={styles.catText}>{catLabel}</Text></View>
        </View>

        <View style={styles.walletCard}>
          <Text style={styles.walletLabel}>WALLET BALANCE</Text>
          <Text style={styles.walletAmount}>{Number(balance).toLocaleString()} <Text style={styles.walletCurrency}>FCFA</Text></Text>
        </View>

        <View style={styles.section}>
          <Row icon="call-outline" label="Phone" value={driver.phone_number} />
          <Row icon="location-outline" label="City" value={driver.city?.city_name} />
          <Row icon="card-outline" label="License" value={driver.driver_license_no} last />
        </View>

        {vehicle && (
          <View style={styles.section}>
            <Row icon="car-outline" label="Vehicle" value={[vehicle.brand, vehicle.model].filter(Boolean).join(' ') || vehicle.vehicle_type} />
            <Row icon="pricetag-outline" label="Plate" value={vehicle.plate_number} />
            {vehicle.color && <Row icon="color-palette-outline" label="Color" value={vehicle.color} last />}
          </View>
        )}

        <TouchableOpacity style={styles.signOut} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={18} color={theme.danger} /><Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ icon, label, value, last }) {
  return (
    <View style={[styles.row, !last && styles.rowBorder]}>
      <View style={styles.rowIcon}><Ionicons name={icon} size={18} color={theme.textMuted} /></View>
      <View style={{ flex: 1 }}><Text style={styles.rowLabel}>{label}</Text><Text style={styles.rowValue}>{value || '—'}</Text></View>
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
  catBadge: { marginTop: 10, backgroundColor: theme.primaryFaint, borderWidth: 1, borderColor: theme.primaryBorder, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 12 },
  catText: { color: theme.primary, fontSize: 12, fontWeight: '700' },
  walletCard: { backgroundColor: theme.surface, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: theme.primaryBorder, marginBottom: 16 },
  walletLabel: { fontSize: 11, fontWeight: '700', color: theme.textMuted, letterSpacing: 1, marginBottom: 8 },
  walletAmount: { fontSize: 30, fontWeight: '800', color: theme.primary },
  walletCurrency: { fontSize: 14, color: theme.textMuted },
  section: { backgroundColor: theme.surface, borderRadius: 16, borderWidth: 1, borderColor: theme.border, marginBottom: 16, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: theme.divider },
  rowIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.05)', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  rowLabel: { fontSize: 11, fontWeight: '700', color: theme.textMuted, letterSpacing: 0.5 },
  rowValue: { fontSize: 15, color: theme.text, marginTop: 2 },
  signOut: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, backgroundColor: theme.dangerFaint, borderWidth: 1, borderColor: 'rgba(255,71,87,0.25)', padding: 16, borderRadius: 12, marginTop: 8 },
  signOutText: { color: theme.danger, fontSize: 15, fontWeight: '700' },
});
