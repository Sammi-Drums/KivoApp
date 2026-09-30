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
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../lib/supabase";
import { theme } from "../../theme/colors";
import {
  startLocationBroadcast,
  stopLocationBroadcast,
} from "../../lib/driverLocation";
import {
  getAcceptedTiers,
  DRIVER_CATEGORIES,
  TIER_LABELS,
} from "../../lib/tiers";

const NEARBY_KM = 5;

// Distance in km between two lat/lon points
function kmBetween(lat1, lon1, lat2, lon2) {
  const R = 6371,
    toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1),
    dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Keep only rides within NEARBY_KM of the driver's location.
// Trips without pickup coords are shown (backward compatibility).
function filterNearby(trips, driverLat, driverLon) {
  if (!driverLat || !driverLon) return trips;
  return (trips || []).filter((t) => {
    if (!t.pickup_latitude || !t.pickup_longitude) return true;
    return (
      kmBetween(driverLat, driverLon, t.pickup_latitude, t.pickup_longitude) <=
      NEARBY_KM
    );
  });
}

export default function HomeScreen() {
  const router = useRouter();
  const [driver, setDriver] = useState(null);
  const [isOnline, setIsOnline] = useState(false);
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
      .select(
        "id, full_name, driver_category, is_online, current_latitude, current_longitude, vehicles(id, plate_number)",
      )
      .eq("user_id", user.id)
      .maybeSingle();
    setDriver(d);
    if (!d) {
      setLoading(false);
      return;
    }

    const online = d.is_online || false;
    setIsOnline(online);
    // If online, make sure we're broadcasting location (for nearby matching)
    if (online) startLocationBroadcast(d.id);

    const accepted = getAcceptedTiers(d.driver_category || "economy");

    const { data: og } = await supabase
      .from("trips")
      .select("*, passenger:passengers(full_name)")
      .eq("driver_id", d.id)
      .in("trip_status", ["accepted", "ongoing"])
      .maybeSingle();
    setOngoing(og);

    // Only fetch available rides if the driver is ONLINE
    if (online) {
      const { data: trips } = await supabase
        .from("trips")
        .select(
          "*, passenger:passengers(full_name), pickup_latitude, pickup_longitude",
        )
        .is("driver_id", null)
        .eq("trip_status", "requested")
        .in("ride_tier", accepted)
        .order("created_at", { ascending: false })
        .limit(20);
      setAvailableTrips(
        filterNearby(trips, d.current_latitude, d.current_longitude),
      );
    } else {
      setAvailableTrips([]);
    }

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

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // Real-time: new requests — only when online, matching category, and nearby
  useEffect(() => {
    if (!driver?.driver_category || !isOnline) return;
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
          // Nearby check
          if (nt.pickup_latitude && driver.current_latitude) {
            const dist = kmBetween(
              driver.current_latitude,
              driver.current_longitude,
              nt.pickup_latitude,
              nt.pickup_longitude,
            );
            if (dist > NEARBY_KM) return;
          }
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
  }, [
    driver?.driver_category,
    driver?.current_latitude,
    driver?.current_longitude,
    isOnline,
  ]);

  const toggleOnline = async () => {
    if (!driver) return;
    const next = !isOnline;
    setIsOnline(next);
    await supabase
      .from("drivers")
      .update({ is_online: next })
      .eq("id", driver.id);
    if (next) {
      await startLocationBroadcast(driver.id);
      await load(); // refresh to pull nearby rides
    } else {
      stopLocationBroadcast();
      setAvailableTrips([]);
    }
  };

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
          {/* Online/Offline toggle */}
          <TouchableOpacity
            onPress={toggleOnline}
            style={[
              styles.toggleBtn,
              {
                backgroundColor: isOnline
                  ? theme.primaryFaint
                  : theme.dangerFaint,
                borderColor: isOnline
                  ? theme.primaryBorder
                  : "rgba(255,71,87,0.25)",
              },
            ]}
          >
            <View
              style={[
                styles.toggleDot,
                { backgroundColor: isOnline ? theme.primary : theme.danger },
              ]}
            />
            <Text
              style={[
                styles.toggleText,
                { color: isOnline ? theme.primary : theme.danger },
              ]}
            >
              {isOnline ? "Online" : "Offline"}
            </Text>
          </TouchableOpacity>
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

        {!isOnline ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Ionicons name="power" size={26} color={theme.danger} />
            </View>
            <Text style={styles.emptyTitle}>You're offline</Text>
            <Text style={styles.emptySub}>
              Tap "Offline" above to go online and receive nearby rides
            </Text>
          </View>
        ) : availableTrips.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Ionicons name="wifi" size={26} color={theme.primary} />
            </View>
            <Text style={styles.emptyTitle}>Waiting for ride requests…</Text>
            <Text style={styles.emptySub}>
              You'll see rides within {NEARBY_KM} km matching your category
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
  toggleBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  toggleDot: { width: 8, height: 8, borderRadius: 4 },
  toggleText: { fontSize: 13, fontWeight: "700" },
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
