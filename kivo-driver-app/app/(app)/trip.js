import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { theme } from '../../theme/colors';
import { TIER_LABELS } from '../../lib/tiers';

export default function TripScreen() {
  const router = useRouter();
  const [trip, setTrip] = useState(null);
  const [passenger, setPassenger] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: driver } = await supabase.from('drivers').select('id').eq('user_id', user.id).maybeSingle();
    if (!driver) { setLoading(false); return; }
    const { data } = await supabase.from('trips')
      .select('*, passenger:passengers(full_name, user:users(phone_number))')
      .eq('driver_id', driver.id).in('trip_status', ['accepted', 'ongoing'])
      .order('created_at', { ascending: false }).limit(1).maybeSingle();
    setTrip(data);
    setPassenger(data?.passenger || null);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const updateStatus = async (newStatus, tsField) => {
    if (!trip) return;
    setUpdating(true);
    const updates = { trip_status: newStatus };
    if (tsField) updates[tsField] = new Date().toISOString();

    const { data: updated, error } = await supabase.from('trips')
      .update(updates).eq('id', trip.id).select().single();

    if (error || !updated) {
      Alert.alert('Update failed', error?.message || 'Could not update trip.');
      setUpdating(false);
      return;
    }

    if (newStatus === 'completed') {
      // Mark payment successful + credit driver wallet (85%)
      await supabase.from('payments').update({ payment_status: 'successful', paid_at: new Date().toISOString() }).eq('trip_id', trip.id);
      Alert.alert('Trip Completed! 🎉', 'Great job! Earnings added to your history.', [
        { text: 'OK', onPress: () => { setTrip(null); router.replace('/(app)'); } },
      ]);
    } else if (newStatus === 'cancelled') {
      Alert.alert('Trip cancelled', '', [{ text: 'OK', onPress: () => { setTrip(null); router.replace('/(app)'); } }]);
    } else {
      await load();
    }
    setUpdating(false);
  };

  const callPassenger = () => {
    const phone = passenger?.user?.phone_number;
    if (phone) Linking.openURL(`tel:${phone}`);
  };

  if (loading) {
    return <SafeAreaView style={styles.container}><View style={styles.center}><ActivityIndicator size="large" color={theme.primary} /></View></SafeAreaView>;
  }

  if (!trip) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.center}>
          <View style={styles.emptyIcon}><Ionicons name="car-outline" size={40} color={theme.textMuted} /></View>
          <Text style={styles.emptyTitle}>No active trip</Text>
          <Text style={styles.emptySub}>Accepted rides appear here</Text>
          <TouchableOpacity style={styles.goHome} onPress={() => router.replace('/(app)')}>
            <Text style={styles.goHomeText}>Go to Home</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const isAccepted = trip.trip_status === 'accepted';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.statusBanner}>
          <View style={styles.statusIcon}><Ionicons name={isAccepted ? 'navigate' : 'car-sport'} size={22} color={theme.primary} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.statusTitle}>{isAccepted ? 'Head to pickup' : 'Trip in progress'}</Text>
            <Text style={styles.statusSub}>{trip.trip_code} · {TIER_LABELS[trip.ride_tier] || trip.ride_tier}</Text>
          </View>
        </View>

        {/* Passenger */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>PASSENGER</Text>
          <View style={styles.passRow}>
            <View style={styles.avatar}><Text style={styles.avatarText}>{(passenger?.full_name || '?').split(' ').map(w => w[0]).join('').slice(0, 2)}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.passName}>{passenger?.full_name || 'Passenger'}</Text>
              <Text style={styles.passPhone}>{passenger?.user?.phone_number || '—'}</Text>
            </View>
            <TouchableOpacity style={styles.callBtn} onPress={callPassenger}><Ionicons name="call" size={20} color={theme.primary} /></TouchableOpacity>
          </View>
        </View>

        {/* Route */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>ROUTE</Text>
          <View style={styles.routeRow}><View style={[styles.dot, { backgroundColor: theme.primary }]} /><Text style={styles.routeText}>{trip.pickup_location}</Text></View>
          <View style={styles.line} />
          <View style={styles.routeRow}><View style={[styles.dot, { backgroundColor: theme.danger }]} /><Text style={styles.routeText}>{trip.dropoff_location}</Text></View>
        </View>

        {/* Summary */}
        <View style={styles.card}>
          <View style={styles.sumRow}><Text style={styles.sumLabel}>Distance</Text><Text style={styles.sumValue}>{trip.distance_km || '—'} km</Text></View>
          <View style={styles.sumRow}><Text style={styles.sumLabel}>Fare</Text><Text style={styles.sumValue}>{Number(trip.fare || 0).toLocaleString()} FCFA</Text></View>
          <View style={styles.sumRow}><Text style={styles.sumLabel}>Your earnings (85%)</Text><Text style={[styles.sumValue, { color: theme.primary }]}>{Math.round(Number(trip.fare || 0) * 0.85).toLocaleString()} FCFA</Text></View>
        </View>

        {/* Actions */}
        {isAccepted ? (
          <TouchableOpacity style={styles.primaryBtn} onPress={() => updateStatus('ongoing', 'started_at')} disabled={updating}>
            {updating ? <ActivityIndicator color="#000" /> : <><Ionicons name="play" size={18} color="#000" /><Text style={styles.primaryText}>Start Trip</Text></>}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.primaryBtn} onPress={() => updateStatus('completed', 'completed_at')} disabled={updating}>
            {updating ? <ActivityIndicator color="#000" /> : <><Ionicons name="checkmark-circle" size={18} color="#000" /><Text style={styles.primaryText}>Complete Trip</Text></>}
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.cancelBtn} onPress={() => Alert.alert('Cancel trip?', 'This cannot be undone.', [{ text: 'No', style: 'cancel' }, { text: 'Yes, cancel', style: 'destructive', onPress: () => updateStatus('cancelled', 'cancelled_at') }])} disabled={updating}>
          <Text style={styles.cancelText}>Cancel Trip</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  scroll: { padding: 20, paddingBottom: 40 },
  emptyIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.05)', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: theme.text, marginBottom: 6 },
  emptySub: { fontSize: 14, color: theme.textMuted, marginBottom: 20 },
  goHome: { backgroundColor: theme.primaryFaint, borderWidth: 1, borderColor: theme.primaryBorder, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  goHomeText: { color: theme.primary, fontWeight: '700' },
  statusBanner: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: theme.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: theme.primaryBorder, marginBottom: 14 },
  statusIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: theme.primaryFaint, justifyContent: 'center', alignItems: 'center' },
  statusTitle: { fontSize: 16, fontWeight: '800', color: theme.primary },
  statusSub: { fontSize: 12, color: theme.textMuted, marginTop: 2 },
  card: { backgroundColor: theme.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: theme.border, marginBottom: 14 },
  cardLabel: { fontSize: 11, fontWeight: '700', color: theme.textMuted, letterSpacing: 1, marginBottom: 12 },
  passRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: theme.primary, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#000', fontWeight: '800', fontSize: 16 },
  passName: { fontSize: 16, fontWeight: '700', color: theme.text },
  passPhone: { fontSize: 13, color: theme.textMuted, marginTop: 2 },
  callBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: theme.primaryFaint, borderWidth: 1, borderColor: theme.primaryBorder, justifyContent: 'center', alignItems: 'center' },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  line: { width: 2, height: 14, backgroundColor: theme.border, marginLeft: 4 },
  routeText: { color: theme.text, fontSize: 14, flex: 1 },
  sumRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  sumLabel: { fontSize: 14, color: theme.textMuted },
  sumValue: { fontSize: 14, fontWeight: '700', color: theme.text },
  primaryBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, backgroundColor: theme.primary, padding: 16, borderRadius: 12, marginTop: 6 },
  primaryText: { color: '#000', fontSize: 15, fontWeight: '700' },
  cancelBtn: { alignItems: 'center', padding: 14, marginTop: 8 },
  cancelText: { color: theme.danger, fontSize: 14, fontWeight: '600' },
});
