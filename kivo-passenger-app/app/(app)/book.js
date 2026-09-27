import { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import { supabase } from "../../lib/supabase";
import {
  getCurrentLocation,
  reverseGeocode,
  searchPlaces,
  getRoute,
  haversineKm,
} from "../../lib/location";
import { RIDE_TIERS } from "../../lib/tiers";
import { getPricingConfig, calculateFare } from "../../lib/pricing";
import { validateCoupon, recordCouponUsage } from "../../lib/coupons";
import { theme } from "../../theme/colors";

const PAYMENTS = [
  { value: "cash", label: "Cash", icon: "cash-outline" },
  {
    value: "mobile_money",
    label: "Mobile Money",
    icon: "phone-portrait-outline",
  },
];

export default function BookScreen() {
  const router = useRouter();
  const [pickup, setPickup] = useState(null);
  const [dropoff, setDropoff] = useState(null);
  const [route, setRoute] = useState(null);
  const [tier, setTier] = useState("economy");
  const [payment, setPayment] = useState("cash");
  const [config, setConfig] = useState(null);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Direct-typing search state
  const [activeField, setActiveField] = useState(null); // 'pickup' | 'dropoff' | null
  const [pickupText, setPickupText] = useState("");
  const [dropoffText, setDropoffText] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const searchTimer = useRef(null);

  const [couponCode, setCouponCode] = useState("");
  const [couponApplied, setCouponApplied] = useState(null);
  const [couponError, setCouponError] = useState(null);
  const [validatingCoupon, setValidatingCoupon] = useState(false);

  useEffect(() => {
    getPricingConfig().then(setConfig);
  }, []);

  // Prefill pickup with current location
  useEffect(() => {
    (async () => {
      const res = await getCurrentLocation();
      if (!res.error) {
        const addr = await reverseGeocode(res.latitude, res.longitude);
        const p = {
          latitude: res.latitude,
          longitude: res.longitude,
          address: addr || "Current location",
        };
        setPickup(p);
        setPickupText(p.address);
      }
    })();
  }, []);

  // Debounced search as user types
  const onType = (text, field) => {
    if (field === "pickup") setPickupText(text);
    else setDropoffText(text);
    setActiveField(field);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (text.trim().length < 3) {
      setResults([]);
      return;
    }
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      const found = await searchPlaces(text.trim());
      setResults(found);
      setSearching(false);
    }, 500);
  };

  const pickResult = (item) => {
    const loc = {
      latitude: item.latitude,
      longitude: item.longitude,
      address: item.name,
    };
    if (activeField === "pickup") {
      setPickup(loc);
      setPickupText(item.name);
    } else {
      setDropoff(loc);
      setDropoffText(item.name);
    }
    setResults([]);
    setActiveField(null);
    Keyboard.dismiss();
  };

  const useMyLocationForPickup = async () => {
    const res = await getCurrentLocation();
    if (res.error) {
      Alert.alert("Location", "Could not get your location.");
      return;
    }
    const addr = await reverseGeocode(res.latitude, res.longitude);
    const p = {
      latitude: res.latitude,
      longitude: res.longitude,
      address: addr || "Current location",
    };
    setPickup(p);
    setPickupText(p.address);
    setResults([]);
    setActiveField(null);
  };

  // Calculate route when both set
  useEffect(() => {
    if (pickup && dropoff) {
      setLoadingRoute(true);
      getRoute(
        pickup.latitude,
        pickup.longitude,
        dropoff.latitude,
        dropoff.longitude,
      ).then((r) => {
        if (r) setRoute(r);
        else {
          const km = haversineKm(
            pickup.latitude,
            pickup.longitude,
            dropoff.latitude,
            dropoff.longitude,
          );
          setRoute({
            distanceKm: km,
            durationMin: Math.round((km / 25) * 60),
            coordinates: [pickup, dropoff],
          });
        }
        setLoadingRoute(false);
        setCouponApplied(null);
      });
    }
  }, [pickup, dropoff]);

  const distance = route?.distanceKm || 0;
  const durationMin = route?.durationMin || 0;
  const baseFare =
    distance > 0 && config
      ? calculateFare(
          distance,
          durationMin,
          tier,
          config.pricing,
          config.multipliers,
        )
      : 0;
  const displayFare = couponApplied ? couponApplied.finalFare : baseFare;
  const discountAmount = couponApplied?.discount || 0;

  const applyCoupon = async () => {
    if (!couponCode.trim() || baseFare <= 0) return;
    setValidatingCoupon(true);
    setCouponError(null);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { data: passenger } = await supabase
        .from("passengers")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!passenger) {
        setCouponError("Profile not found.");
        return;
      }
      const result = await validateCoupon(couponCode, passenger.id, baseFare);
      if (result.valid) {
        setCouponApplied(result);
      } else {
        setCouponApplied(null);
        setCouponError(result.reason);
      }
    } catch {
      setCouponError("Something went wrong.");
    } finally {
      setValidatingCoupon(false);
    }
  };

  const canSubmit = pickup && dropoff && distance > 0 && !submitting;

  const handleBook = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { data: passenger } = await supabase
        .from("passengers")
        .select("id")
        .eq("user_id", user.id)
        .single();
      if (!passenger) throw new Error("Passenger profile not found");
      const finalFare = couponApplied ? couponApplied.finalFare : baseFare;
      const { data: trip, error: tripError } = await supabase
        .from("trips")
        .insert({
          passenger_id: passenger.id,
          driver_id: null,
          pickup_location: pickup.address,
          dropoff_location: dropoff.address,
          pickup_latitude: pickup.latitude,
          pickup_longitude: pickup.longitude,
          dropoff_latitude: dropoff.latitude,
          dropoff_longitude: dropoff.longitude,
          distance_km: distance,
          duration_minutes: durationMin,
          fare: finalFare,
          trip_status: "requested",
          ride_tier: tier,
          promotion_id: couponApplied?.promotion?.id || null,
          discount_amount: discountAmount,
        })
        .select()
        .single();
      if (tripError) throw tripError;
      if (couponApplied)
        await recordCouponUsage(
          couponApplied.promotion.id,
          passenger.id,
          trip.id,
          discountAmount,
        );
      await supabase
        .from("payments")
        .insert({
          trip_id: trip.id,
          amount: finalFare,
          payment_method: payment,
          payment_status: "pending",
        });
      Alert.alert(
        "Ride Requested! 🎉",
        `Trip ${trip.trip_code} created. A driver will accept shortly.`,
        [{ text: "View", onPress: () => router.push("/(app)/history") }],
      );
      setDropoff(null);
      setDropoffText("");
      setRoute(null);
      setCouponApplied(null);
      setCouponCode("");
    } catch (err) {
      Alert.alert("Booking failed", err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const mapRegion = pickup
    ? {
        latitude: dropoff
          ? (pickup.latitude + dropoff.latitude) / 2
          : pickup.latitude,
        longitude: dropoff
          ? (pickup.longitude + dropoff.longitude) / 2
          : pickup.longitude,
        latitudeDelta: dropoff
          ? Math.abs(pickup.latitude - dropoff.latitude) * 1.8 + 0.02
          : 0.02,
        longitudeDelta: dropoff
          ? Math.abs(pickup.longitude - dropoff.longitude) * 1.8 + 0.02
          : 0.02,
      }
    : {
        latitude: 5.9631,
        longitude: 10.1591,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Book a Ride</Text>

        {/* Direct-type PICKUP */}
        <View style={styles.field}>
          <View style={styles.fieldRow}>
            <View style={[styles.dot, { backgroundColor: theme.primary }]} />
            <TextInput
              style={styles.fieldInput}
              value={pickupText}
              onChangeText={(t) => onType(t, "pickup")}
              onFocus={() => setActiveField("pickup")}
              placeholder="Pickup location"
              placeholderTextColor={theme.textFaint}
              editable={!submitting}
            />
            <TouchableOpacity
              onPress={useMyLocationForPickup}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="locate" size={20} color={theme.primary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Direct-type DROPOFF */}
        <View style={styles.field}>
          <View style={styles.fieldRow}>
            <View style={[styles.dot, { backgroundColor: theme.danger }]} />
            <TextInput
              style={styles.fieldInput}
              value={dropoffText}
              onChangeText={(t) => onType(t, "dropoff")}
              onFocus={() => setActiveField("dropoff")}
              placeholder="Where to?"
              placeholderTextColor={theme.textFaint}
              editable={!submitting}
            />
          </View>
        </View>

        {/* Search results dropdown */}
        {activeField && (results.length > 0 || searching) && (
          <View style={styles.results}>
            {searching && (
              <View style={styles.searchingRow}>
                <ActivityIndicator size="small" color={theme.primary} />
                <Text style={styles.searchingText}>Searching…</Text>
              </View>
            )}
            {results.map((item, i) => (
              <TouchableOpacity
                key={i}
                style={styles.resultRow}
                onPress={() => pickResult(item)}
              >
                <Ionicons
                  name="location-outline"
                  size={18}
                  color={theme.textMuted}
                />
                <Text style={styles.resultText} numberOfLines={2}>
                  {item.fullName}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Map preview (Google tiles) */}
        {pickup && (
          <View style={styles.mapCard}>
            <MapView
              provider={PROVIDER_GOOGLE}
              style={styles.map}
              region={mapRegion}
            >
              <Marker coordinate={pickup} title="Pickup" pinColor="green" />
              {dropoff && (
                <Marker coordinate={dropoff} title="Drop-off" pinColor="red" />
              )}
              {route?.coordinates && (
                <Polyline
                  coordinates={route.coordinates}
                  strokeColor={theme.primary}
                  strokeWidth={4}
                />
              )}
            </MapView>
          </View>
        )}

        {loadingRoute && (
          <View style={styles.routeLoading}>
            <ActivityIndicator size="small" color={theme.primary} />
            <Text style={styles.routeLoadingText}>Calculating route…</Text>
          </View>
        )}
        {distance > 0 && !loadingRoute && (
          <View style={styles.distInfo}>
            <Text style={styles.distLabel}>Distance</Text>
            <Text style={styles.distValue}>
              {distance} km · ≈ {durationMin} min
            </Text>
          </View>
        )}

        {distance > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>CHOOSE YOUR RIDE</Text>
            {RIDE_TIERS.map((t) => {
              const sel = tier === t.value;
              const price = config
                ? calculateFare(
                    distance,
                    durationMin,
                    t.value,
                    config.pricing,
                    config.multipliers,
                  )
                : 0;
              return (
                <TouchableOpacity
                  key={t.value}
                  style={[styles.opt, sel && styles.optSel]}
                  onPress={() => {
                    setTier(t.value);
                    setCouponApplied(null);
                  }}
                >
                  <View style={[styles.optIcon, sel && styles.optIconSel]}>
                    <Ionicons
                      name={t.icon}
                      size={22}
                      color={sel ? theme.primary : theme.textMuted}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.optName}>{t.label}</Text>
                    <Text style={styles.optDesc}>{t.tagline}</Text>
                  </View>
                  <Text
                    style={[styles.optPrice, sel && { color: theme.primary }]}
                  >
                    {price.toLocaleString()}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {distance > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>PAYMENT METHOD</Text>
            <View style={styles.payRow}>
              {PAYMENTS.map((p) => {
                const sel = payment === p.value;
                return (
                  <TouchableOpacity
                    key={p.value}
                    style={[styles.payOpt, sel && styles.paySel]}
                    onPress={() => setPayment(p.value)}
                  >
                    <Ionicons
                      name={p.icon}
                      size={20}
                      color={sel ? theme.primary : theme.textMuted}
                    />
                    <Text
                      style={[styles.payLabel, sel && { color: theme.primary }]}
                    >
                      {p.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {distance > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>PROMO CODE (OPTIONAL)</Text>
            {couponApplied ? (
              <View style={styles.appliedCoupon}>
                <Ionicons name="pricetag" size={20} color={theme.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.appliedCode}>
                    {couponApplied.promotion.promo_code}
                  </Text>
                  <Text style={styles.appliedDesc}>
                    You save {couponApplied.discount.toLocaleString()} FCFA
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    setCouponApplied(null);
                    setCouponCode("");
                  }}
                >
                  <Ionicons
                    name="close-circle"
                    size={20}
                    color={theme.textMuted}
                  />
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <View style={styles.couponRow}>
                  <TextInput
                    style={styles.couponInput}
                    value={couponCode}
                    onChangeText={(t) => {
                      setCouponCode(t.toUpperCase());
                      setCouponError(null);
                    }}
                    placeholder="Enter code"
                    placeholderTextColor={theme.textFaint}
                    autoCapitalize="characters"
                    editable={!validatingCoupon && !submitting}
                  />
                  <TouchableOpacity
                    style={[
                      styles.applyBtn,
                      (!couponCode.trim() ||
                        baseFare <= 0 ||
                        validatingCoupon) && { opacity: 0.4 },
                    ]}
                    onPress={applyCoupon}
                    disabled={
                      !couponCode.trim() || baseFare <= 0 || validatingCoupon
                    }
                  >
                    {validatingCoupon ? (
                      <ActivityIndicator color={theme.primary} size="small" />
                    ) : (
                      <Text style={styles.applyText}>Apply</Text>
                    )}
                  </TouchableOpacity>
                </View>
                {couponError && (
                  <View style={styles.couponErr}>
                    <Ionicons
                      name="alert-circle"
                      size={14}
                      color={theme.danger}
                    />
                    <Text style={styles.couponErrText}>{couponError}</Text>
                  </View>
                )}
              </>
            )}
          </View>
        )}

        {distance > 0 && (
          <View style={styles.fareSummary}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fareLabel}>TOTAL FARE</Text>
              {discountAmount > 0 && (
                <Text style={styles.fareOrig}>
                  −{discountAmount.toLocaleString()} off
                </Text>
              )}
              <Text style={styles.fareAmount}>
                {displayFare.toLocaleString()}{" "}
                <Text style={styles.fareCurrency}>FCFA</Text>
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.bookBtn, !canSubmit && { opacity: 0.4 }]}
              onPress={handleBook}
              disabled={!canSubmit}
            >
              {submitting ? (
                <ActivityIndicator color="#000" />
              ) : (
                <>
                  <Text style={styles.bookText}>Request</Text>
                  <Ionicons name="arrow-forward" size={18} color="#000" />
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  scroll: { padding: 20, paddingBottom: 40 },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: theme.text,
    marginTop: 8,
    marginBottom: 16,
  },
  field: {
    backgroundColor: theme.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.border,
    marginBottom: 10,
  },
  fieldRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
  },
  dot: { width: 12, height: 12, borderRadius: 6 },
  fieldInput: { flex: 1, color: theme.text, fontSize: 15 },
  results: {
    backgroundColor: theme.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
    marginBottom: 14,
    overflow: "hidden",
  },
  searchingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 14,
  },
  searchingText: { color: theme.textMuted, fontSize: 13 },
  resultRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.divider,
  },
  resultText: { flex: 1, color: theme.text, fontSize: 14 },
  mapCard: {
    height: 180,
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 14,
    borderWidth: 1,
    borderColor: theme.border,
  },
  map: { flex: 1 },
  routeLoading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 12,
  },
  routeLoadingText: { color: theme.textMuted, fontSize: 13 },
  distInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
    backgroundColor: theme.primaryFaint,
    borderRadius: 10,
    marginBottom: 14,
  },
  distLabel: { fontSize: 12, color: theme.textMuted },
  distValue: { fontSize: 14, color: theme.primary, fontWeight: "700" },
  card: {
    backgroundColor: theme.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.border,
    marginBottom: 14,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    color: theme.textMuted,
    marginBottom: 12,
  },
  opt: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "transparent",
    gap: 12,
    marginBottom: 6,
  },
  optSel: {
    backgroundColor: theme.primaryFaint,
    borderColor: theme.primaryBorder,
  },
  optIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.05)",
    justifyContent: "center",
    alignItems: "center",
  },
  optIconSel: { backgroundColor: theme.primaryFaint },
  optName: { fontSize: 15, fontWeight: "700", color: theme.text },
  optDesc: { fontSize: 12, color: theme.textMuted, marginTop: 2 },
  optPrice: { fontSize: 15, fontWeight: "700", color: theme.textMuted },
  payRow: { flexDirection: "row", gap: 10 },
  payOpt: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.borderStrong,
  },
  paySel: {
    backgroundColor: theme.primaryFaint,
    borderColor: theme.primaryBorder,
  },
  payLabel: { fontSize: 13, fontWeight: "600", color: theme.textMuted },
  couponRow: { flexDirection: "row", gap: 8 },
  couponInput: {
    flex: 1,
    backgroundColor: theme.bg,
    borderWidth: 1,
    borderColor: theme.borderStrong,
    borderRadius: 10,
    padding: 12,
    color: theme.text,
    fontSize: 14,
    letterSpacing: 1,
  },
  applyBtn: {
    paddingHorizontal: 20,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: theme.primaryFaint,
    borderWidth: 1,
    borderColor: theme.primaryBorder,
  },
  applyText: { color: theme.primary, fontWeight: "700", fontSize: 13 },
  couponErr: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
  },
  couponErrText: { color: theme.danger, fontSize: 12 },
  appliedCoupon: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: theme.primaryFaint,
    borderWidth: 1,
    borderColor: theme.primaryBorder,
    borderRadius: 10,
    padding: 12,
  },
  appliedCode: {
    color: theme.text,
    fontWeight: "800",
    fontSize: 14,
    letterSpacing: 1,
  },
  appliedDesc: { color: theme.textMuted, fontSize: 11, marginTop: 2 },
  fareSummary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: theme.surface,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: theme.primaryBorder,
    gap: 14,
  },
  fareLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: theme.textMuted,
    letterSpacing: 1,
  },
  fareOrig: { fontSize: 12, color: theme.textMuted, marginTop: 3 },
  fareAmount: {
    fontSize: 24,
    fontWeight: "800",
    color: theme.primary,
    marginTop: 4,
  },
  fareCurrency: { fontSize: 12, color: theme.textMuted },
  bookBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: theme.primary,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  bookText: { color: "#000", fontSize: 14, fontWeight: "700" },
});
