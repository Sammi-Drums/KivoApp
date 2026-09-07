import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../lib/supabase";
import { theme } from "../../theme/colors";

export default function HomeScreen() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [activeTrip, setActiveTrip] = useState(null);
  const [recentTrips, setRecentTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: passenger } = await supabase
      .from("passengers")
      .select("id, full_name")
      .eq("user_id", user.id)
      .maybeSingle();
    if (passenger) {
      setName(passenger.full_name?.split(" ")[0] || "there");

      const { data: active } = await supabase
        .from("trips")
        .select("*")
        .eq("passenger_id", passenger.id)
        .in("trip_status", ["requested", "accepted", "ongoing"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      setActiveTrip(active);

      const { data: recent } = await supabase
        .from("trips")
        .select(
          "trip_code, pickup_location, dropoff_location, fare, trip_status, created_at",
        )
        .eq("passenger_id", passenger.id)
        .order("created_at", { ascending: false })
        .limit(3);
      setRecentTrips(recent || []);
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const statusColor = {
    requested: theme.warn,
    accepted: theme.info,
    ongoing: theme.info,
    completed: theme.primary,
    cancelled: theme.danger,
  };

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
            <Text style={styles.greeting}>Hello, {name}</Text>
            <Text style={styles.subtitle}>Where are you going today?</Text>
          </View>
          <View style={styles.logo}>
            <Text style={styles.logoText}>KR</Text>
          </View>
        </View>

        {/* Big book CTA */}
        <TouchableOpacity
          style={styles.bookCta}
          onPress={() => router.push("/(app)/book")}
          activeOpacity={0.9}
        >
          <View style={styles.bookIconWrap}>
            <Ionicons name="location" size={26} color={theme.onPrimary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.bookTitle}>Book a Ride</Text>
            <Text style={styles.bookSub}>Enter your destination and go</Text>
          </View>
          <Ionicons name="arrow-forward" size={22} color={theme.onPrimary} />
        </TouchableOpacity>

        {/* Active trip banner */}
        {activeTrip && (
          <TouchableOpacity
            style={styles.activeBanner}
            onPress={() => router.push("/(app)/history")}
            activeOpacity={0.85}
          >
            <View style={styles.activeDot} />
            <View style={{ flex: 1 }}>
              <Text style={styles.activeLabel}>
                ACTIVE TRIP · {activeTrip.trip_status.toUpperCase()}
              </Text>
              <Text style={styles.activeRoute}>
                {activeTrip.pickup_location} → {activeTrip.dropoff_location}
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={theme.textMuted}
            />
          </TouchableOpacity>
        )}

        {/* Recent trips */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Trips</Text>
          {recentTrips.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="car-outline" size={32} color={theme.textMuted} />
              <Text style={styles.emptyText}>
                No trips yet. Book your first ride!
              </Text>
            </View>
          ) : (
            recentTrips.map((trip, i) => (
              <View key={i} style={styles.tripCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.tripCode}>{trip.trip_code}</Text>
                  <Text style={styles.tripRoute} numberOfLines={1}>
                    {trip.pickup_location} → {trip.dropoff_location}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={styles.tripFare}>
                    {Number(trip.fare || 0).toLocaleString()} FCFA
                  </Text>
                  <Text
                    style={[
                      styles.tripStatus,
                      {
                        color: statusColor[trip.trip_status] || theme.textMuted,
                      },
                    ]}
                  >
                    {trip.trip_status}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
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
    marginBottom: 24,
  },
  greeting: { fontSize: 26, fontWeight: "800", color: theme.text },
  subtitle: { fontSize: 14, color: theme.textMuted, marginTop: 4 },
  logo: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: theme.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  logoText: { color: "#000", fontWeight: "800", fontSize: 15 },
  bookCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: theme.primary,
    borderRadius: 18,
    padding: 20,
    marginBottom: 16,
  },
  bookIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(0,0,0,0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  bookTitle: { fontSize: 18, fontWeight: "800", color: theme.onPrimary },
  bookSub: { fontSize: 13, color: "rgba(0,0,0,0.6)", marginTop: 2 },
  activeBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: theme.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.primaryBorder,
    marginBottom: 24,
  },
  activeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.primary,
  },
  activeLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: theme.primary,
    letterSpacing: 1,
    marginBottom: 4,
  },
  activeRoute: { fontSize: 14, color: theme.text },
  section: {},
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: theme.text,
    marginBottom: 14,
  },
  emptyCard: {
    backgroundColor: theme.surface,
    borderRadius: 16,
    padding: 30,
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: theme.border,
  },
  emptyText: { fontSize: 14, color: theme.textMuted },
  tripCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.border,
    marginBottom: 10,
    gap: 12,
  },
  tripCode: {
    fontSize: 12,
    fontWeight: "700",
    color: theme.textMuted,
    marginBottom: 4,
  },
  tripRoute: { fontSize: 14, color: theme.text },
  tripFare: { fontSize: 14, fontWeight: "800", color: theme.text },
  tripStatus: {
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2,
    textTransform: "capitalize",
  },
});
