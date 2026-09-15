import { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../lib/supabase";
import PasswordInput, {
  isPasswordStrongEnough,
} from "../../components/PasswordInput";
import { DRIVER_CATEGORIES } from "../../lib/tiers";
import { pickDocument, pickProfilePhoto, uploadFile } from "../../lib/uploads";
import { theme } from "../../theme/colors";

const VEHICLE_TYPE_BY_CATEGORY = {
  bike: "moto",
  economy: "car",
  comfort: "car",
};

export default function SignupScreen() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [licenseNo, setLicenseNo] = useState("");
  const [cityId, setCityId] = useState("");
  const [category, setCategory] = useState("economy");
  const [plate, setPlate] = useState("");
  const [cities, setCities] = useState([]);
  const [loading, setLoading] = useState(false);

  // Uploads
  const [docFile, setDocFile] = useState(null); // { uri, name }
  const [photo, setPhoto] = useState(null); // { uri }

  useEffect(() => {
    supabase
      .from("cities")
      .select("id, city_name")
      .order("city_name")
      .then(({ data }) => setCities(data || []));
  }, []);

  const chooseDoc = async () => {
    const r = await pickDocument();
    if (r.error) {
      Alert.alert("Error", r.error);
      return;
    }
    if (!r.cancelled) setDocFile(r);
  };

  const choosePhoto = async () => {
    const r = await pickProfilePhoto();
    if (r.error) {
      Alert.alert("Error", r.error);
      return;
    }
    if (!r.cancelled) setPhoto(r);
  };

  const handleSignup = async () => {
    if (
      !fullName.trim() ||
      !phone.trim() ||
      !email.trim() ||
      !password ||
      !licenseNo.trim() ||
      !cityId ||
      !plate.trim()
    ) {
      Alert.alert("Missing info", "Please fill in all fields including city.");
      return;
    }
    if (!isPasswordStrongEnough(password)) {
      Alert.alert("Weak password", "Use at least 8 characters.");
      return;
    }
    if (!docFile) {
      Alert.alert(
        "Documents required",
        "Please upload your documents PDF (license, ID, registration, insurance).",
      );
      return;
    }
    if (!photo) {
      Alert.alert("Photo required", "Please upload a profile photo.");
      return;
    }

    setLoading(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { full_name: fullName, role: "driver" } },
      });
      if (authError) throw authError;
      if (!authData.user) throw new Error("Signup failed.");
      const userId = authData.user.id;
      const username =
        fullName.toLowerCase().replace(/\s+/g, ".") +
        "." +
        Date.now().toString().slice(-4);

      const { error: userError } = await supabase.from("users").insert({
        id: userId,
        username,
        password_hash: "managed_by_supabase_auth",
        email: email.trim(),
        phone_number: phone,
        role: "driver",
        status: "active",
      });
      if (userError) throw userError;

      // Upload profile photo
      const photoResult = await uploadFile(
        photo.uri,
        `${userId}/profile.jpg`,
        "image/jpeg",
      );
      if (photoResult.error)
        throw new Error("Photo upload failed: " + photoResult.error);

      const { data: driver, error: driverError } = await supabase
        .from("drivers")
        .insert({
          user_id: userId,
          full_name: fullName,
          phone_number: phone,
          email: email.trim(),
          city_id: cityId,
          driver_license_no: licenseNo,
          approval_status: "pending",
          driver_status: "inactive",
          onboarding_method: "self_registered",
          driver_category: category,
          profile_photo_url: photoResult.url,
        })
        .select()
        .single();
      if (driverError) throw driverError;

      // Upload documents PDF + record it
      const docResult = await uploadFile(
        docFile.uri,
        `${userId}/documents.pdf`,
        "application/pdf",
      );
      if (docResult.error)
        throw new Error("Document upload failed: " + docResult.error);

      await supabase.from("driver_documents").insert({
        driver_id: driver.id,
        document_type: "driver_license",
        document_url: docResult.url,
        verification_status: "pending",
      });

      await supabase.from("vehicles").insert({
        driver_id: driver.id,
        vehicle_type: VEHICLE_TYPE_BY_CATEGORY[category] || "car",
        plate_number: plate,
        vehicle_status: "active",
      });

      await supabase.from("wallets").insert({ user_id: userId, balance: 0 });

      setLoading(false);
      Alert.alert(
        "Application submitted! 🎉",
        "Your application is under review. Our team will approve you within 24-48 hours.",
      );
    } catch (err) {
      await supabase.auth.signOut();
      Alert.alert("Signup failed", err.message);
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <TouchableOpacity
            style={styles.back}
            onPress={() => router.back()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="chevron-back" size={24} color={theme.textMuted} />
          </TouchableOpacity>
          <Text style={styles.title}>Apply to drive</Text>
          <Text style={styles.subtitle}>
            Your application will be reviewed by our team
          </Text>

          <Field
            label="FULL NAME"
            value={fullName}
            onChangeText={setFullName}
            placeholder="e.g. Etienne Kamga"
            editable={!loading}
          />
          <Field
            label="PHONE NUMBER"
            value={phone}
            onChangeText={setPhone}
            placeholder="+237 6XX XXX XXX"
            keyboardType="phone-pad"
            editable={!loading}
          />
          <Field
            label="EMAIL"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            editable={!loading}
          />

          <View style={styles.field}>
            <Text style={styles.label}>PASSWORD</Text>
            <PasswordInput
              value={password}
              onChangeText={setPassword}
              placeholder="At least 8 characters"
              showStrength
              editable={!loading}
            />
          </View>

          <Field
            label="DRIVER LICENSE NUMBER"
            value={licenseNo}
            onChangeText={setLicenseNo}
            placeholder="e.g. CM1234567"
            editable={!loading}
          />

          <View style={styles.field}>
            <Text style={styles.label}>OPERATING CITY</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8 }}
            >
              {cities.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  onPress={() => setCityId(c.id)}
                  style={[styles.chip, cityId === c.id && styles.chipSel]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      cityId === c.id && { color: theme.primary },
                    ]}
                  >
                    {c.city_name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>DRIVER CATEGORY</Text>
            {Object.entries(DRIVER_CATEGORIES).map(([key, cat]) => {
              const sel = category === key;
              return (
                <TouchableOpacity
                  key={key}
                  onPress={() => setCategory(key)}
                  style={[styles.catCard, sel && styles.catSel]}
                  activeOpacity={0.85}
                >
                  <View style={styles.catHeader}>
                    <Ionicons
                      name={sel ? "radio-button-on" : "radio-button-off"}
                      size={20}
                      color={sel ? theme.primary : theme.textMuted}
                    />
                    <Text style={styles.catLabel}>{cat.label}</Text>
                  </View>
                  <Text style={styles.catTagline}>{cat.tagline}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Field
            label="PLATE NUMBER"
            value={plate}
            onChangeText={setPlate}
            placeholder="e.g. LT 234 AB"
            autoCapitalize="characters"
            editable={!loading}
          />

          {/* Profile photo upload */}
          <View style={styles.field}>
            <Text style={styles.label}>PROFILE PHOTO</Text>
            <TouchableOpacity
              style={styles.uploadBox}
              onPress={choosePhoto}
              disabled={loading}
            >
              {photo ? (
                <View style={styles.photoPreview}>
                  <Image source={{ uri: photo.uri }} style={styles.photoImg} />
                  <Text style={styles.uploadedText}>
                    Photo selected · tap to change
                  </Text>
                </View>
              ) : (
                <View style={styles.uploadInner}>
                  <Ionicons
                    name="camera-outline"
                    size={24}
                    color={theme.primary}
                  />
                  <Text style={styles.uploadText}>Tap to select a photo</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Documents PDF upload */}
          <View style={styles.field}>
            <Text style={styles.label}>DOCUMENTS (PDF)</Text>
            <Text style={styles.hint}>
              Combine license, national ID, vehicle registration & insurance
              into one PDF
            </Text>
            <TouchableOpacity
              style={styles.uploadBox}
              onPress={chooseDoc}
              disabled={loading}
            >
              <View style={styles.uploadInner}>
                <Ionicons
                  name={docFile ? "document-text" : "document-attach-outline"}
                  size={24}
                  color={theme.primary}
                />
                <Text style={styles.uploadText}>
                  {docFile
                    ? `${docFile.name} · tap to change`
                    : "Tap to select PDF"}
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.button, loading && { opacity: 0.6 }]}
            onPress={handleSignup}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color={theme.onPrimary} />
            ) : (
              <>
                <Text style={styles.buttonText}>Submit Application</Text>
                <Ionicons
                  name="arrow-forward"
                  size={18}
                  color={theme.onPrimary}
                />
              </>
            )}
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Already a driver?</Text>
            <TouchableOpacity onPress={() => router.push("/(auth)/login")}>
              <Text style={styles.footerLink}>Sign in</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({ label, ...props }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        placeholderTextColor={theme.textFaint}
        {...props}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  scroll: { flexGrow: 1, padding: 24, paddingBottom: 80 },
  back: { alignSelf: "flex-start", padding: 8, marginBottom: 12 },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: theme.text,
    marginBottom: 6,
  },
  subtitle: { fontSize: 14, color: theme.textMuted, marginBottom: 24 },
  field: { marginBottom: 16 },
  label: {
    fontSize: 11,
    fontWeight: "700",
    color: theme.textMuted,
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  hint: {
    fontSize: 12,
    color: theme.textFaint,
    marginBottom: 8,
    marginTop: -2,
  },
  input: {
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.borderStrong,
    borderRadius: 12,
    padding: 16,
    color: theme.text,
    fontSize: 15,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.borderStrong,
    backgroundColor: theme.surface,
  },
  chipSel: {
    backgroundColor: theme.primaryFaint,
    borderColor: theme.primaryBorder,
  },
  chipText: { color: theme.textMuted, fontSize: 13, fontWeight: "600" },
  catCard: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.borderStrong,
    backgroundColor: theme.surface,
    marginBottom: 8,
  },
  catSel: {
    backgroundColor: theme.primaryFaint,
    borderColor: theme.primaryBorder,
  },
  catHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  catLabel: { fontSize: 15, fontWeight: "700", color: theme.text },
  catTagline: { fontSize: 13, color: theme.textMuted, marginLeft: 28 },
  uploadBox: {
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.primaryBorder,
    borderStyle: "dashed",
    borderRadius: 12,
    padding: 16,
  },
  uploadInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  uploadText: { color: theme.text, fontSize: 14, fontWeight: "600" },
  photoPreview: { flexDirection: "row", alignItems: "center", gap: 12 },
  photoImg: { width: 48, height: 48, borderRadius: 24 },
  uploadedText: { color: theme.textMuted, fontSize: 13 },
  button: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    backgroundColor: theme.primary,
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
  },
  buttonText: { color: theme.onPrimary, fontSize: 15, fontWeight: "700" },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    marginTop: 24,
  },
  footerText: { color: theme.textMuted, fontSize: 14 },
  footerLink: { color: theme.primary, fontSize: 14, fontWeight: "700" },
});
