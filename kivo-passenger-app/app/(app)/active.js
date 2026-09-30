import { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { supabase } from "../../lib/supabase";
import { haversineKm } from "../../lib/location";
import { theme } from "../../theme/colors";

const STATUS = {
  accepted: {
    title: "Driver on the way",
    color: theme.info,
    icon: "car-outline",
  },
  ongoing: { title: "On your trip", color: theme.warn, icon: "navigate" },
};

export default function ActiveTripScreen() {
  const router = useRouter();
  const mapRef = useRef(null);
  const [trip, setTrip] = useState(null);
  const [driver, setDriver] = useState(null);
  const [vehicle, setVehicle] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { data: passenger } = await supabase
      .from("passengers")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!passenger) {
      setLoading(false);
      return;
    }

    const { data: activeTrip } = await supabase
      .from("trips")
      .select("*")
      .eq("passenger_id", passenger.id)
      .in("trip_status", ["accepted", "ongoing"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setTrip(activeTrip);

    if (activeTrip?.driver_id) {
      const { data: d } = await supabase
        .from("drivers")
        .select(
          "full_name, phone_number, profile_photo_url, rating_average, rating_count, current_latitude, current_longitude, location_updated_at",
        )
        .eq("id", activeTrip.driver_id)
        .maybeSingle();
      setDriver(d);
      if (activeTrip.vehicle_id) {
        const { data: v } = await supabase
          .from("vehicles")
          .select("vehicle_type, plate_number, color, brand, model")
          .eq("id", activeTrip.vehicle_id)
          .maybeSingle();
        setVehicle(v);
      }
    }
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // Real-time: driver location updates + trip status changes
  useEffect(() => {
    if (!trip?.driver_id) return;
    const channel = supabase
      .channel(`track-${trip.driver_id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "drivers",
          filter: `id=eq.${trip.driver_id}`,
        },
        (payload) => {
          if (payload.new?.current_latitude) {
            setDriver((prev) => ({
              ...prev,
              current_latitude: payload.new.current_latitude,
              current_longitude: payload.new.current_longitude,
              location_updated_at: payload.new.location_updated_at,
            }));
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "trips",
          filter: `id=eq.${trip.id}`,
        },
        (payload) => {
          if (
            payload.new.trip_status === "completed" ||
            payload.new.trip_status === "cancelled"
          ) {
            router.replace("/(app)/history");
          } else {
            setTrip((prev) => ({ ...prev, ...payload.new }));
          }
        },
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [trip?.driver_id, trip?.id, router]);

  const callDriver = () => {
    if (driver?.phone_number) Linking.openURL(`tel:${driver.phone_number}`);
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

  if (!trip) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.center}>
          <View style={styles.emptyIcon}>
            <Ionicons name="car-outline" size={40} color={theme.textMuted} />
          </View>
          <Text style={styles.emptyTitle}>No active trip</Text>
          <Text style={styles.emptySub}>
            Book a ride to track your driver here
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const status = STATUS[trip.trip_status] || STATUS.accepted;

  // Driver ETA to pickup (straight-line estimate)
  let etaText = "Locating driver…";
  if (driver?.current_latitude && trip.pickup_latitude) {
    const km = haversineKm(
      driver.current_latitude,
      driver.current_longitude,
      trip.pickup_latitude,
      trip.pickup_longitude,
    );
    const mins = Math.max(1, Math.round((km / 25) * 60));
    etaText =
      trip.trip_status === "accepted"
        ? `${km.toFixed(1)} km away · ~${mins} min to pickup`
        : "On the way to destination";
  }

  // Map region — fit driver + pickup
  const hasDriverLoc = driver?.current_latitude && driver?.current_longitude;
  const region =
    hasDriverLoc && trip.pickup_latitude
      ? {
          latitude: (driver.current_latitude + trip.pickup_latitude) / 2,
          longitude: (driver.current_longitude + trip.pickup_longitude) / 2,
          latitudeDelta:
            Math.abs(driver.current_latitude - trip.pickup_latitude) * 2 + 0.02,
          longitudeDelta:
            Math.abs(driver.current_longitude - trip.pickup_longitude) * 2 +
            0.02,
        }
      : trip.pickup_latitude
        ? {
            latitude: trip.pickup_latitude,
            longitude: trip.pickup_longitude,
            latitudeDelta: 0.02,
            longitudeDelta: 0.02,
          }
        : {
            latitude: 5.9631,
            longitude: 10.1591,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Live map */}
        <View style={styles.mapCard}>
          <MapView
            ref={mapRef}
            provider={PROVIDER_GOOGLE}
            style={styles.map}
            region={region}
          >
            {trip.pickup_latitude && (
              <Marker
                coordinate={{
                  latitude: trip.pickup_latitude,
                  longitude: trip.pickup_longitude,
                }}
                title="Pickup"
                pinColor="green"
              />
            )}
            {trip.dropoff_latitude && (
              <Marker
                coordinate={{
                  latitude: trip.dropoff_latitude,
                  longitude: trip.dropoff_longitude,
                }}
                title="Drop-off"
                pinColor="red"
              />
            )}
            {hasDriverLoc && (
              <Marker
                coordinate={{
                  latitude: driver.current_latitude,
                  longitude: driver.current_longitude,
                }}
                title="Your driver"
              >
                <View style={styles.driverMarker}>
                  <Ionicons name="car-sport" size={20} color="#000" />
                </View>
              </Marker>
            )}
          </MapView>
        </View>

        {/* Status + ETA */}
        <View
          style={[styles.statusBanner, { borderColor: status.color + "40" }]}
        >
          <View
            style={[
              styles.statusIcon,
              { backgroundColor: status.color + "20" },
            ]}
          >
            <Ionicons name={status.icon} size={22} color={status.color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.statusTitle, { color: status.color }]}>
              {status.title}
            </Text>
            <Text style={styles.etaText}>{etaText}</Text>
          </View>
        </View>

        {/* Driver card */}
        {driver && (
          <View style={styles.card}>
            <View style={styles.driverRow}>
              <View style={styles.avatar}>
                {driver.profile_photo_url ? (
                  <Text style={styles.avatarText}>
                    {(driver.full_name || "?")
                      .split(" ")
                      .map((w) => w[0])
                      .join("")
                      .slice(0, 2)}
                  </Text>
                ) : (
                  <Text style={styles.avatarText}>
                    {(driver.full_name || "?")
                      .split(" ")
                      .map((w) => w[0])
                      .join("")
                      .slice(0, 2)}
                  </Text>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.driverName}>{driver.full_name}</Text>
                {driver.rating_count > 0 && (
                  <View style={styles.ratingRow}>
                    <Ionicons name="star" size={13} color={theme.warn} />
                    <Text style={styles.ratingText}>
                      {Number(driver.rating_average).toFixed(1)}
                    </Text>
                  </View>
                )}
              </View>
              <TouchableOpacity style={styles.callBtn} onPress={callDriver}>
                <Ionicons name="call" size={20} color={theme.primary} />
              </TouchableOpacity>
            </View>
            {vehicle && (
              <View style={styles.vehicleRow}>
                <Ionicons name="car" size={16} color={theme.textMuted} />
                <Text style={styles.vehicleText}>
                  {[vehicle.color, vehicle.brand, vehicle.model]
                    .filter(Boolean)
                    .join(" ") || vehicle.vehicle_type}
                </Text>
                <View style={styles.plateChip}>
                  <Text style={styles.plateText}>{vehicle.plate_number}</Text>
                </View>
              </View>
            )}
          </View>
        )}

        {/* Route summary */}
        <View style={styles.card}>
          <View style={styles.routeRow}>
            <View style={[styles.dot, { backgroundColor: theme.primary }]} />
            <Text style={styles.routeText}>{trip.pickup_location}</Text>
          </View>
          <View style={styles.line} />
          <View style={styles.routeRow}>
            <View style={[styles.dot, { backgroundColor: theme.danger }]} />
            <Text style={styles.routeText}>{trip.dropoff_location}</Text>
          </View>
          <View style={styles.fareRow}>
            <Text style={styles.fareLabel}>Fare</Text>
            <Text style={styles.fareValue}>
              {Number(trip.fare).toLocaleString()} FCFA
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  scroll: { padding: 16, paddingBottom: 40 },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255,255,255,0.05)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: theme.text,
    marginBottom: 6,
  },
  emptySub: { fontSize: 14, color: theme.textMuted, textAlign: "center" },
  mapCard: {
    height: 280,
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 14,
    borderWidth: 1,
    borderColor: theme.border,
  },
  map: { flex: 1 },
  driverMarker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.primary,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  statusBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: theme.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    marginBottom: 14,
  },
  statusIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  statusTitle: { fontSize: 16, fontWeight: "800" },
  etaText: { fontSize: 13, color: theme.textMuted, marginTop: 2 },
  card: {
    backgroundColor: theme.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.border,
    marginBottom: 14,
  },
  driverRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: theme.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: { color: "#000", fontWeight: "800", fontSize: 18 },
  driverName: { fontSize: 16, fontWeight: "700", color: theme.text },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 3,
  },
  ratingText: { fontSize: 13, color: theme.textMuted, fontWeight: "600" },
  callBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.primaryFaint,
    borderWidth: 1,
    borderColor: theme.primaryBorder,
    justifyContent: "center",
    alignItems: "center",
  },
  vehicleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: theme.divider,
  },
  vehicleText: {
    flex: 1,
    fontSize: 14,
    color: theme.text,
    textTransform: "capitalize",
  },
  plateChip: {
    backgroundColor: theme.primaryFaint,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  plateText: {
    fontSize: 12,
    fontWeight: "800",
    color: theme.primary,
    fontFamily: "monospace",
  },
  routeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 4,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  line: { width: 2, height: 14, backgroundColor: theme.border, marginLeft: 4 },
  routeText: { color: theme.text, fontSize: 14, flex: 1 },
  fareRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.divider,
  },
  fareLabel: { color: theme.textMuted, fontSize: 13 },
  fareValue: { color: theme.primary, fontSize: 18, fontWeight: "800" },
});
