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
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../lib/supabase";
import {
  getCurrentLocation,
  reverseGeocode,
  forwardGeocode,
  estimateRoadDistance,
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
  const dropoffRef = useRef(null);

  const [pickup, setPickup] = useState("");
  const [pickupCoords, setPickupCoords] = useState(null);
  const [dropoff, setDropoff] = useState("");
  const [distance, setDistance] = useState(0);
  const [tier, setTier] = useState("economy");
  const [payment, setPayment] = useState("cash");
  const [config, setConfig] = useState(null);
  const [locating, setLocating] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [couponCode, setCouponCode] = useState("");
  const [validatingCoupon, setValidatingCoupon] = useState(false);
  const [couponApplied, setCouponApplied] = useState(null);
  const [couponError, setCouponError] = useState(null);

  useEffect(() => {
    getPricingConfig().then(setConfig);
  }, []);

  const useMyLocation = async () => {
    setLocating(true);
    const result = await getCurrentLocation();
    if (result.error === "permission_denied") {
      Alert.alert(
        "Location needed",
        "Please enable location access in settings.",
      );
      setLocating(false);
      return;
    }
    if (result.error) {
      Alert.alert(
        "Location failed",
        "Could not get location. Type it manually.",
      );
      setLocating(false);
      return;
    }
    setPickupCoords({ latitude: result.latitude, longitude: result.longitude });
    const addr = await reverseGeocode(result.latitude, result.longitude);
    setPickup(
      addr ||
        `Current location (${result.latitude.toFixed(4)}, ${result.longitude.toFixed(4)})`,
    );
    setLocating(false);
    setTimeout(() => dropoffRef.current?.focus(), 100);
  };

  const calcDistance = async () => {
    if (!pickupCoords || !dropoff.trim()) {
      Alert.alert("Missing info", "Set pickup and destination first.");
      return;
    }
    setCalculating(true);
    const lookup = await forwardGeocode(dropoff.trim());
    if (!lookup) {
      Alert.alert(
        "Not found",
        'Try being more specific (e.g. "UB Campus Bambili").',
      );
      setCalculating(false);
      return;
    }
    const km = estimateRoadDistance(
      pickupCoords.latitude,
      pickupCoords.longitude,
      lookup.latitude,
      lookup.longitude,
    );
    setDistance(Math.round(km * 10) / 10);
    setCalculating(false);
    setCouponApplied(null);
    setCouponError(null);
  };

  const durationMin = Math.round((distance / 25) * 60);
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
        setCouponError(null);
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

  const removeCoupon = () => {
    setCouponApplied(null);
    setCouponCode("");
    setCouponError(null);
  };

  const canSubmit =
    pickup.trim() && dropoff.trim() && distance > 0 && !submitting;

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
          pickup_location: pickup.trim(),
          dropoff_location: dropoff.trim(),
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

      await supabase.from("payments").insert({
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
      setPickup("");
      setPickupCoords(null);
      setDropoff("");
      setDistance(0);
      removeCoupon();
    } catch (err) {
      Alert.alert("Booking failed", err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.title}>Book a Ride</Text>
          <Text style={styles.subtitle}>Where are you going?</Text>

          {/* Route */}
          <View style={styles.card}>
            <View style={styles.routeRow}>
              <View style={[styles.dot, { backgroundColor: theme.primary }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.routeLabel}>PICKUP</Text>
                <TextInput
                  style={styles.routeInput}
                  value={pickup}
                  onChangeText={setPickup}
                  placeholder="Your location"
                  placeholderTextColor={theme.textFaint}
                  editable={!submitting}
                />
              </View>
            </View>
            <TouchableOpacity
              style={styles.gpsBtn}
              onPress={useMyLocation}
              disabled={locating}
            >
              {locating ? (
                <ActivityIndicator color={theme.primary} size="small" />
              ) : (
                <>
                  <Ionicons name="locate" size={16} color={theme.primary} />
                  <Text style={styles.gpsText}>Use my current location</Text>
                </>
              )}
            </TouchableOpacity>
            <View style={styles.routeLine} />
            <View style={styles.routeRow}>
              <View style={[styles.dot, { backgroundColor: theme.danger }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.routeLabel}>DROP-OFF</Text>
                <TextInput
                  ref={dropoffRef}
                  style={styles.routeInput}
                  value={dropoff}
                  onChangeText={setDropoff}
                  placeholder="e.g. UB Campus Bambili"
                  placeholderTextColor={theme.textFaint}
                  editable={!submitting}
                />
              </View>
            </View>
            <TouchableOpacity
              style={[
                styles.calcBtn,
                (!pickupCoords || !dropoff.trim() || calculating) && {
                  opacity: 0.5,
                },
              ]}
              onPress={calcDistance}
              disabled={!pickupCoords || !dropoff.trim() || calculating}
            >
              {calculating ? (
                <ActivityIndicator color={theme.text} size="small" />
              ) : (
                <>
                  <Ionicons name="calculator" size={16} color={theme.text} />
                  <Text style={styles.calcText}>Calculate distance</Text>
                </>
              )}
            </TouchableOpacity>
            {distance > 0 && (
              <View style={styles.distInfo}>
                <Text style={styles.distLabel}>Distance</Text>
                <Text style={styles.distValue}>
                  {distance} km · ≈ {durationMin} min
                </Text>
              </View>
            )}
          </View>

          {/* Ride tiers */}
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>CHOOSE YOUR RIDE</Text>
            {RIDE_TIERS.map((t) => {
              const sel = tier === t.value;
              const price =
                distance > 0 && config
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
                    setCouponError(null);
                  }}
                  disabled={submitting}
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
                  {price > 0 && (
                    <Text
                      style={[styles.optPrice, sel && { color: theme.primary }]}
                    >
                      {price.toLocaleString()}
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Payment */}
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
                    disabled={submitting}
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

          {/* Coupon */}
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
                  onPress={removeCoupon}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
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

          {/* Fare + book */}
          <View style={styles.fareSummary}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fareLabel}>TOTAL FARE</Text>
              {discountAmount > 0 && (
                <Text style={styles.fareOrig}>
                  <Text style={{ textDecorationLine: "line-through" }}>
                    {baseFare.toLocaleString()}
                  </Text>{" "}
                  −{discountAmount.toLocaleString()}
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
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  scroll: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 26, fontWeight: "800", color: theme.text, marginTop: 8 },
  subtitle: {
    fontSize: 14,
    color: theme.textMuted,
    marginTop: 4,
    marginBottom: 20,
  },
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
  routeRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  dot: { width: 12, height: 12, borderRadius: 6, marginTop: 20 },
  routeLine: {
    width: 2,
    height: 20,
    backgroundColor: theme.border,
    marginLeft: 5,
    marginVertical: 4,
  },
  routeLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: theme.textMuted,
    letterSpacing: 1,
  },
  routeInput: {
    fontSize: 15,
    color: theme.text,
    paddingVertical: 6,
    paddingBottom: 8,
  },
  gpsBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: theme.primaryFaint,
    borderWidth: 1,
    borderColor: theme.primaryBorder,
    borderRadius: 10,
    padding: 10,
    marginTop: 6,
    marginBottom: 6,
  },
  gpsText: { color: theme.primary, fontSize: 13, fontWeight: "700" },
  calcBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 10,
    padding: 10,
    marginTop: 6,
  },
  calcText: { color: theme.text, fontSize: 13, fontWeight: "700" },
  distInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
    padding: 10,
    backgroundColor: theme.primaryFaint,
    borderRadius: 8,
  },
  distLabel: { fontSize: 12, color: theme.textMuted },
  distValue: { fontSize: 14, color: theme.primary, fontWeight: "700" },
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
    marginTop: 6,
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
