import { useEffect, useState, createContext, useContext, useCallback } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { supabase } from '../lib/supabase';
import { theme } from '../theme/colors';

const ApprovalContext = createContext(null);
export function useApproval() { return useContext(ApprovalContext); }

export default function RootLayout() {
  const [session, setSession] = useState(null);
  const [approvalStatus, setApprovalStatus] = useState(null);
  const [hasDriverRecord, setHasDriverRecord] = useState(null);
  const [driverId, setDriverId] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const segments = useSegments();

  const checkApproval = useCallback(async (userId) => {
    if (!userId) return;
    const { data, error } = await supabase
      .from('drivers').select('id, approval_status').eq('user_id', userId).maybeSingle();
    if (error || !data) { setHasDriverRecord(false); setDriverId(null); setApprovalStatus(null); return; }
    setHasDriverRecord(true); setDriverId(data.id); setApprovalStatus(data.approval_status);
  }, []);

  const refreshApproval = useCallback(async () => {
    if (session?.user?.id) await checkApproval(session.user.id);
  }, [session, checkApproval]);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      if (session?.user) await checkApproval(session.user.id);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_e, session) => {
      setSession(session);
      if (session?.user) await checkApproval(session.user.id);
      else { setApprovalStatus(null); setDriverId(null); setHasDriverRecord(null); }
    });
    return () => subscription.unsubscribe();
  }, [checkApproval]);

  // Real-time: auto-transition when admin approves
  useEffect(() => {
    if (!driverId) return;
    const channel = supabase.channel(`driver-approval-${driverId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'drivers', filter: `id=eq.${driverId}` },
        (payload) => { if (payload.new?.approval_status) setApprovalStatus(payload.new.approval_status); })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [driverId]);

  // 3-state routing
  useEffect(() => {
    if (loading) return;
    const inAuth = segments[0] === '(auth)';
    const inPending = segments[0] === '(pending)';
    const inApp = segments[0] === '(app)';

    if (!session) { if (!inAuth) router.replace('/(auth)/login'); return; }
    if (hasDriverRecord === false) { supabase.auth.signOut(); return; }
    if (approvalStatus === 'approved') { if (!inApp) router.replace('/(app)'); return; }
    if (approvalStatus === 'pending' || approvalStatus === 'rejected') { if (!inPending) router.replace('/(pending)'); return; }
  }, [session, hasDriverRecord, approvalStatus, loading, segments]);

  if (loading) {
    return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.bg }}><ActivityIndicator size="large" color={theme.primary} /></View>;
  }

  return (
    <ApprovalContext.Provider value={{ approvalStatus, refreshApproval }}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.bg } }} />
    </ApprovalContext.Provider>
  );
}
