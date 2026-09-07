import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { theme } from '../../theme/colors';
import { useApproval } from '../_layout';

export default function PendingScreen() {
  const { approvalStatus, refreshApproval } = useApproval();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshApproval();
    setRefreshing(false);
  };

  const rejected = approvalStatus === 'rejected';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={[styles.iconWrap, rejected && { backgroundColor: theme.dangerFaint }]}>
          <Ionicons name={rejected ? 'close-circle-outline' : 'hourglass-outline'} size={56} color={rejected ? theme.danger : theme.warn} />
        </View>

        <Text style={styles.title}>{rejected ? 'Application not approved' : 'Application under review'}</Text>
        <Text style={styles.subtitle}>
          {rejected
            ? 'Unfortunately your application was not approved. Please contact support for more information.'
            : 'Thanks for applying! Our team is reviewing your details. This usually takes 24-48 hours.'}
        </Text>

        {!rejected && (
          <View style={styles.timeline}>
            <Step done label="Application submitted" />
            <Step active label="Under review by our team" />
            <Step label="Approved & ready to drive" />
          </View>
        )}

        <TouchableOpacity style={styles.refreshBtn} onPress={handleRefresh} disabled={refreshing}>
          {refreshing ? <ActivityIndicator color={theme.primary} size="small" /> : <><Ionicons name="refresh" size={16} color={theme.primary} /><Text style={styles.refreshText}>Check status</Text></>}
        </TouchableOpacity>

        <TouchableOpacity style={styles.signOut} onPress={() => supabase.auth.signOut()}>
          <Text style={styles.signOutText}>Sign out</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function Step({ done, active, label }) {
  return (
    <View style={styles.step}>
      <View style={[styles.stepDot, done && { backgroundColor: theme.primary }, active && { backgroundColor: theme.warn }]}>
        {done && <Ionicons name="checkmark" size={12} color="#000" />}
      </View>
      <Text style={[styles.stepLabel, (done || active) && { color: theme.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  iconWrap: { width: 100, height: 100, borderRadius: 50, backgroundColor: theme.warnFaint, justifyContent: 'center', alignItems: 'center', marginBottom: 24 },
  title: { fontSize: 22, fontWeight: '800', color: theme.text, textAlign: 'center', marginBottom: 10 },
  subtitle: { fontSize: 14, color: theme.textMuted, textAlign: 'center', lineHeight: 20, marginBottom: 32 },
  timeline: { alignSelf: 'stretch', gap: 20, marginBottom: 32 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepDot: { width: 24, height: 24, borderRadius: 12, backgroundColor: theme.surface2, borderWidth: 1, borderColor: theme.borderStrong, justifyContent: 'center', alignItems: 'center' },
  stepLabel: { fontSize: 14, color: theme.textMuted },
  refreshBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: theme.primaryFaint, borderWidth: 1, borderColor: theme.primaryBorder, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, marginBottom: 16 },
  refreshText: { color: theme.primary, fontWeight: '700', fontSize: 14 },
  signOut: { padding: 12 },
  signOutText: { color: theme.textMuted, fontSize: 14 },
});
