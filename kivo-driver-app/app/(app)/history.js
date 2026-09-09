import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { theme } from '../../theme/colors';

const STATUS = {
  accepted: { label: 'Accepted', color: theme.info, icon: 'checkmark-outline' },
  ongoing: { label: 'Ongoing', color: theme.info, icon: 'car-outline' },
  completed: { label: 'Completed', color: theme.primary, icon: 'checkmark-circle-outline' },
  cancelled: { label: 'Cancelled', color: theme.danger, icon: 'close-circle-outline' },
};

export default function HistoryScreen() {
  const [trips, setTrips] = useState([]);
  const [totalEarned, setTotalEarned] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: driver } = await supabase.from('drivers').select('id').eq('user_id', user.id).maybeSingle();
    if (!driver) { setLoading(false); return; }
    const { data } = await supabase.from('trips')
      .select('*, passenger:passengers(full_name)')
      .eq('driver_id', driver.id).order('created_at', { ascending: false });
    setTrips(data || []);
    const total = (data || []).filter(t => t.trip_status === 'completed').reduce((s, t) => s + Math.round(Number(t.fare || 0) * 0.85), 0);
    setTotalEarned(total);
    setLoading(false); setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  const onRefresh = () => { setRefreshing(true); load(); };

  if (loading) {
    return <SafeAreaView style={styles.container}><View style={styles.center}><ActivityIndicator size="large" color={theme.primary} /></View></SafeAreaView>;
  }

  const completedCount = trips.filter(t => t.trip_status === 'completed').length;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}>
        <Text style={styles.title}>Trip History</Text>
        <Text style={styles.subtitle}>{completedCount} completed · Pull to refresh</Text>

        <View style={styles.earnCard}>
          <Text style={styles.earnLabel}>TOTAL EARNED</Text>
          <Text style={styles.earnAmount}>{totalEarned.toLocaleString()} <Text style={styles.earnCurrency}>FCFA</Text></Text>
          <Text style={styles.earnHint}>After 15% platform fee</Text>
        </View>

        {trips.length === 0 ? (
          <View style={styles.empty}><View style={styles.emptyIcon}><Ionicons name="time-outline" size={40} color={theme.textMuted} /></View><Text style={styles.emptyTitle}>No trips yet</Text></View>
        ) : (
          trips.map((trip) => {
            const s = STATUS[trip.trip_status] || STATUS.accepted;
            const earn = trip.trip_status === 'completed' ? Math.round(Number(trip.fare) * 0.85) : 0;
            return (
              <View key={trip.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.code}>{trip.trip_code}</Text>
                  <View style={[styles.pill, { backgroundColor: s.color + '22' }]}><Ionicons name={s.icon} size={12} color={s.color} /><Text style={[styles.pillText, { color: s.color }]}>{s.label}</Text></View>
                </View>
                <View style={styles.route}>
                  <View style={styles.routeRow}><View style={[styles.dot, { backgroundColor: theme.primary }]} /><Text style={styles.routeText} numberOfLines={1}>{trip.pickup_location}</Text></View>
                  <View style={styles.line} />
                  <View style={styles.routeRow}><View style={[styles.dot, { backgroundColor: theme.danger }]} /><Text style={styles.routeText} numberOfLines={1}>{trip.dropoff_location}</Text></View>
                </View>
                <View style={styles.footer}>
                  <Text style={styles.meta}>{trip.passenger?.full_name || 'Passenger'}</Text>
                  {trip.trip_status === 'completed' ? <Text style={styles.earn}>+{earn.toLocaleString()} FCFA</Text> : <Text style={styles.fare}>{Number(trip.fare || 0).toLocaleString()} FCFA</Text>}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 26, fontWeight: '800', color: theme.text, marginTop: 8 },
  subtitle: { fontSize: 13, color: theme.textMuted, marginTop: 4, marginBottom: 20 },
  earnCard: { backgroundColor: theme.surface, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: theme.primaryBorder, marginBottom: 20 },
  earnLabel: { fontSize: 11, fontWeight: '700', color: theme.textMuted, letterSpacing: 1, marginBottom: 8 },
  earnAmount: { fontSize: 30, fontWeight: '800', color: theme.primary },
  earnCurrency: { fontSize: 14, color: theme.textMuted },
  earnHint: { fontSize: 12, color: theme.textMuted, marginTop: 8 },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.05)', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: theme.text },
  card: { backgroundColor: theme.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: theme.border, marginBottom: 12 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  code: { fontSize: 13, fontWeight: '700', color: theme.textMuted },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  pillText: { fontSize: 11, fontWeight: '700' },
  route: { marginBottom: 14 },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  line: { width: 2, height: 12, backgroundColor: theme.border, marginLeft: 3 },
  routeText: { fontSize: 14, color: theme.text, flex: 1 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTopWidth: 1, borderTopColor: theme.divider },
  meta: { fontSize: 12, color: theme.textMuted },
  earn: { fontSize: 15, fontWeight: '800', color: theme.primary },
  fare: { fontSize: 14, fontWeight: '700', color: theme.text },
});
