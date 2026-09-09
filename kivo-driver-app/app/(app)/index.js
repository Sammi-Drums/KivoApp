import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../lib/supabase";
import { theme } from "../../theme/colors";
import {
  getAcceptedTiers,
  DRIVER_CATEGORIES,
  TIER_LABELS,
} from "../../lib/tiers";

export default function HomeScreen() {
  const router = useRouter();
  const [driver, setDriver] = useState(null);
  const [availableTrips, setAvailableTrips] = useState([]);
  const [ongoing, setOngoing] = useState(null);
  const [earnings, setEarnings] = useState({ today: 0, week: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [accepting, setAccepting] = useState(null);
  const [pulse, setPulse] = useState(false);

  const load = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { data: d } = await supabase
      .from("drivers")
      .select("id, full_name, driver_category, vehicles(id, plate_number)")
      .eq("user_id", user.id)
      .maybeSingle();
    setDriver(d);
    if (!d) {
      setLoading(false);
      return;
    }

    const accepted = getAcceptedTiers(d.driver_category || "economy");

    const { data: og } = await supabase
      .from("trips")
      .select("*, passenger:passengers(full_name)")
      .eq("driver_id", d.id)
      .in("trip_status", ["accepted", "ongoing"])
      .maybeSingle();
    setOngoing(og);

    const { data: trips } = await supabase
      .from("trips")
      .select("*, passenger:passengers(full_name)")
      .is("driver_id", null)
      .eq("trip_status", "requested")
      .in("ride_tier", accepted)
      .order("created_at", { ascending: false })
      .limit(10);
    setAvailableTrips(trips || []);

    const { data: completed } = await supabase
      .from("trips")
      .select("fare, created_at")
      .eq("driver_id", d.id)
      .eq("trip_status", "completed");
    if (completed) {
      const now = new Date();
      const startDay = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
      );
      const startWeek = new Date(now.getTime() - 7 * 864e5);
      const t = completed
        .filter((x) => new Date(x.created_at) >= startDay)
        .reduce((s, x) => s + Number(x.fare || 0), 0);
      const w = completed
        .filter((x) => new Date(x.created_at) >= startWeek)
        .reduce((s, x) => s + Number(x.fare || 0), 0);
      const tot = completed.reduce((s, x) => s + Number(x.fare || 0), 0);
      setEarnings({
        today: Math.round(t * 0.85),
        week: Math.round(w * 0.85),
        total: Math.round(tot * 0.85),
      });
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Real-time: new requests matching my category
  useEffect(() => {
    if (!driver?.driver_category) return;
    const accepted = getAcceptedTiers(driver.driver_category);
    const channel = supabase
      .channel("driver-requests")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "trips",
          filter: "trip_status=eq.requested",
        },
        async (payload) => {
          const nt = payload.new;
          if (!accepted.includes(nt.ride_tier)) return;
          const { data: passenger } = await supabase
            .from("passengers")
            .select("full_name")
            .eq("id", nt.passenger_id)
            .maybeSingle();
          setAvailableTrips((prev) => [{ ...nt, passenger }, ...prev]);
          setPulse(true);
          setTimeout(() => setPulse(false), 1500);
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "trips" },
        (payload) => {
          if (
            payload.new.driver_id &&
            payload.new.trip_status !== "requested"
          ) {
            setAvailableTrips((prev) =>
              prev.filter((t) => t.id !== payload.new.id),
            );
          }
        },
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [driver?.driver_category]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const handleAccept = (trip) => {
    if (!driver) return;
    if (ongoing) {
      Alert.alert("Trip in progress", "Complete your current trip first.");
      return;
    }
    Alert.alert(
      "Accept this trip?",
      `${TIER_LABELS[trip.ride_tier] || trip.ride_tier}\n${trip.pickup_location} → ${trip.dropoff_location}\n${Number(trip.fare).toLocaleString()} FCFA`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Accept",
          onPress: async () => {
            setAccepting(trip.id);
            const { data: updated, error } = await supabase
              .from("trips")
              .update({
                driver_id: driver.id,
                vehicle_id: driver.vehicles?.[0]?.id || null,
                trip_status: "accepted",
                accepted_at: new Date().toISOString(),
              })
              .eq("id", trip.id)
              .eq("trip_status", "requested")
              .select();
            setAccepting(null);
            if (error) {
              Alert.alert("Failed", error.message);
              return;
            }
            if (!updated || updated.length === 0) {
              Alert.alert(
                "Too late",
                "Another driver already accepted this ride.",
              );
              load();
              return;
            }
            await load();
            router.push("/(app)/trip");
          },
        },
      ],
    );
  };

  const handleReject = (trip) =>
    setAvailableTrips((prev) => prev.filter((t) => t.id !== trip.id));

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const firstName = driver?.full_name?.split(" ")[0] || "Driver";
  const catInfo =
    DRIVER_CATEGORIES[driver?.driver_category] || DRIVER_CATEGORIES.economy;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.primary}
          />
        }
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Hello, {firstName}</Text>
            <Text style={styles.subtitle}>
              {catInfo.label} · {catInfo.tagline}
            </Text>
          </View>
          <View style={styles.live}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>Live</Text>
          </View>
        </View>

        <View style={styles.earningsCard}>
          <Text style={styles.earningsLabel}>YOUR EARNINGS</Text>
          <View style={styles.earningsRow}>
            <Earn label="Today" value={earnings.today} />
            <View style={styles.divider} />
            <Earn label="This week" value={earnings.week} />
            <View style={styles.divider} />
            <Earn label="Total" value={earnings.total} />
          </View>
        </View>

        {ongoing && (
          <TouchableOpacity
            style={styles.ongoingCard}
            onPress={() => router.push("/(app)/trip")}
            activeOpacity={0.85}
          >
            <View style={styles.ongoingIcon}>
              <Ionicons name="car-sport" size={24} color={theme.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.ongoingLabel}>
                ACTIVE TRIP · {ongoing.trip_status.toUpperCase()}
              </Text>
              <Text style={styles.ongoingRoute}>
                {ongoing.pickup_location} → {ongoing.dropoff_location}
              </Text>
              <Text style={styles.ongoingPass}>
                {ongoing.passenger?.full_name}
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={theme.textMuted}
            />
          </TouchableOpacity>
        )}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Available Rides</Text>
          <View style={[styles.countBadge, pulse && styles.countPulse]}>
            <Text style={styles.count}>{availableTrips.length}</Text>
          </View>
        </View>

        {availableTrips.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Ionicons name="wifi" size={26} color={theme.primary} />
            </View>
            <Text style={styles.emptyTitle}>Waiting for ride requests…</Text>
            <Text style={styles.emptySub}>
              You'll only see rides matching your category
            </Text>
          </View>
        ) : (
          availableTrips.map((trip) => (
            <View key={trip.id} style={styles.tripCard}>
              <View style={styles.tripHeader}>
                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
                >
                  <Text style={styles.tripCode}>{trip.trip_code}</Text>
                  <View style={styles.tierBadge}>
                    <Text style={styles.tierText}>
                      {TIER_LABELS[trip.ride_tier] || trip.ride_tier}
                    </Text>
                  </View>
                </View>
                <Text style={styles.tripFare}>
                  {Number(trip.fare || 0).toLocaleString()} FCFA
                </Text>
              </View>
              <View style={styles.route}>
                <View style={styles.routeRow}>
                  <View
                    style={[styles.dot, { backgroundColor: theme.primary }]}
                  />
                  <Text style={styles.routeText} numberOfLines={1}>
                    {trip.pickup_location}
                  </Text>
                </View>
                <View style={styles.line} />
                <View style={styles.routeRow}>
                  <View
                    style={[styles.dot, { backgroundColor: theme.danger }]}
                  />
                  <Text style={styles.routeText} numberOfLines={1}>
                    {trip.dropoff_location}
                  </Text>
                </View>
              </View>
              <View style={styles.tripMeta}>
                <Text style={styles.metaText}>
                  {trip.passenger?.full_name || "Passenger"}
                </Text>
                {trip.distance_km && (
                  <Text style={styles.metaText}>{trip.distance_km} km</Text>
                )}
              </View>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <TouchableOpacity
                  style={styles.rejectBtn}
                  onPress={() => handleReject(trip)}
                  disabled={accepting === trip.id}
                >
                  <Ionicons name="close" size={18} color={theme.danger} />
                  <Text style={styles.rejectText}>Reject</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.acceptBtn,
                    (accepting === trip.id || ongoing) && { opacity: 0.5 },
                  ]}
                  onPress={() => handleAccept(trip)}
                  disabled={accepting === trip.id || !!ongoing}
                >
                  {accepting === trip.id ? (
                    <ActivityIndicator color="#000" size="small" />
                  ) : (
                    <>
                      <Ionicons name="checkmark" size={18} color="#000" />
                      <Text style={styles.acceptText}>Accept</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Earn({ label, value }) {
  return (
    <View style={{ flex: 1, alignItems: "center" }}>
      <Text style={styles.earnValue}>{value.toLocaleString()}</Text>
      <Text style={styles.earnLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  scroll: { padding: 20, paddingBottom: 30 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
    marginBottom: 20,
  },
  greeting: { fontSize: 26, fontWeight: "800", color: theme.text },
  subtitle: { fontSize: 12, color: theme.textMuted, marginTop: 4 },
  live: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: theme.primaryFaint,
    borderWidth: 1,
    borderColor: theme.primaryBorder,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.primary,
  },
  liveText: { fontSize: 11, fontWeight: "700", color: theme.primary },
  earningsCard: {
    backgroundColor: theme.surface,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: theme.primaryBorder,
    marginBottom: 16,
  },
  earningsLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: theme.textMuted,
    letterSpacing: 1,
    marginBottom: 14,
  },
  earningsRow: { flexDirection: "row", alignItems: "center" },
  divider: { width: 1, height: 32, backgroundColor: theme.border },
  earnValue: { fontSize: 18, fontWeight: "800", color: theme.primary },
  earnLabel: { fontSize: 11, color: theme.textMuted, marginTop: 4 },
  ongoingCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: theme.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.primaryBorder,
    marginBottom: 16,
  },
  ongoingIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.primaryFaint,
    justifyContent: "center",
    alignItems: "center",
  },
  ongoingLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: theme.primary,
    letterSpacing: 1,
    marginBottom: 4,
  },
  ongoingRoute: { fontSize: 14, color: theme.text, marginBottom: 2 },
  ongoingPass: { fontSize: 12, color: theme.textMuted },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    marginTop: 4,
  },
  sectionTitle: { fontSize: 18, fontWeight: "800", color: theme.text },
  countBadge: {
    backgroundColor: theme.primaryFaint,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.primaryBorder,
  },
  countPulse: { backgroundColor: theme.primary, transform: [{ scale: 1.15 }] },
  count: { fontSize: 13, fontWeight: "700", color: theme.primary },
  empty: {
    backgroundColor: theme.surface,
    borderRadius: 16,
    padding: 30,
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.border,
  },
  emptyIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: theme.primaryFaint,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: theme.text,
    marginBottom: 4,
  },
  emptySub: { fontSize: 13, color: theme.textMuted, textAlign: "center" },
  tripCard: {
    backgroundColor: theme.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.border,
    marginBottom: 12,
  },
  tripHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  tripCode: {
    fontSize: 12,
    fontWeight: "700",
    color: theme.textMuted,
    letterSpacing: 0.5,
  },
  tierBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: theme.primaryFaint,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  tierText: {
    fontSize: 10,
    fontWeight: "700",
    color: theme.primary,
    letterSpacing: 0.3,
  },
  tripFare: { fontSize: 18, fontWeight: "800", color: theme.primary },
  route: { marginBottom: 12 },
  routeRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  line: { width: 2, height: 14, backgroundColor: theme.border, marginLeft: 3 },
  routeText: { color: theme.text, fontSize: 14, flex: 1 },
  tripMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 10,
    marginBottom: 12,
    borderTopWidth: 1,
    borderTopColor: theme.divider,
  },
  metaText: { fontSize: 13, color: theme.textMuted },
  acceptBtn: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    backgroundColor: theme.primary,
    padding: 12,
    borderRadius: 10,
  },
  acceptText: { color: "#000", fontSize: 14, fontWeight: "700" },
  rejectBtn: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    backgroundColor: theme.dangerFaint,
    borderWidth: 1,
    borderColor: "rgba(255,71,87,0.25)",
    padding: 12,
    borderRadius: 10,
  },
  rejectText: { color: theme.danger, fontSize: 14, fontWeight: "700" },
});
