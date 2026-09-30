import { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import { supabase } from "../../lib/supabase";
import { theme } from "../../theme/colors";

export default function EditProfileScreen() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [photoUrl, setPhotoUrl] = useState(null);
  const [newPhoto, setNewPhoto] = useState(null);
  const [userId, setUserId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      const { data: p } = await supabase
        .from("drivers")
        .select("full_name, profile_photo_url")
        .eq("user_id", user.id)
        .maybeSingle();
      setFullName(p?.full_name || "");
      setPhotoUrl(p?.profile_photo_url || null);
      setLoading(false);
    })();
  }, []);

  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission", "Please allow photo access.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled && result.assets?.[0])
      setNewPhoto(result.assets[0].uri);
  };

  const uploadPhoto = async (uri) => {
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const path = `${userId}/profile.jpg`;
    const { error } = await supabase.storage
      .from("driver-documents")
      .upload(path, bytes, { contentType: "image/jpeg", upsert: true });
    if (error) throw new Error(error.message);
    const {
      data: { publicUrl },
    } = supabase.storage.from("driver-documents").getPublicUrl(path);
    return `${publicUrl}?t=${Date.now()}`;
  };

  const save = async () => {
    if (!fullName.trim()) {
      Alert.alert("Name required", "Please enter your name.");
      return;
    }
    setSaving(true);
    try {
      const updates = { full_name: fullName.trim() };
      if (newPhoto) {
        const url = await uploadPhoto(newPhoto);
        updates.profile_photo_url = url;
      }
      const { error } = await supabase
        .from("drivers")
        .update(updates)
        .eq("user_id", userId);
      if (error) throw error;
      Alert.alert("Saved", "Your profile has been updated.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (err) {
      Alert.alert("Failed", err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading)
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      </SafeAreaView>
    );

  const displayPhoto = newPhoto || photoUrl;
  const initials = (fullName || "?")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="chevron-back" size={26} color={theme.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Edit Profile</Text>
          <View style={{ width: 26 }} />
        </View>

        <TouchableOpacity style={styles.photoWrap} onPress={pickPhoto}>
          {displayPhoto ? (
            <Image source={{ uri: displayPhoto }} style={styles.photo} />
          ) : (
            <View style={styles.photoPlaceholder}>
              <Text style={styles.photoInitials}>{initials}</Text>
            </View>
          )}
          <View style={styles.cameraBadge}>
            <Ionicons name="camera" size={16} color="#000" />
          </View>
        </TouchableOpacity>
        <Text style={styles.photoHint}>Tap to change photo</Text>

        <View style={styles.field}>
          <Text style={styles.label}>FULL NAME</Text>
          <TextInput
            style={styles.input}
            value={fullName}
            onChangeText={setFullName}
            placeholder="Your name"
            placeholderTextColor={theme.textFaint}
          />
        </View>

        <TouchableOpacity
          style={[styles.saveBtn, saving && { opacity: 0.6 }]}
          onPress={save}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text style={styles.saveText}>Save Changes</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  scroll: { padding: 20, paddingBottom: 40 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  title: { fontSize: 18, fontWeight: "800", color: theme.text },
  photoWrap: { alignSelf: "center", position: "relative" },
  photo: { width: 100, height: 100, borderRadius: 50 },
  photoPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: theme.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  photoInitials: { color: "#000", fontWeight: "800", fontSize: 36 },
  cameraBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.primary,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: theme.bg,
  },
  photoHint: {
    textAlign: "center",
    color: theme.textMuted,
    fontSize: 12,
    marginTop: 10,
    marginBottom: 28,
  },
  field: { marginBottom: 20 },
  label: {
    fontSize: 11,
    fontWeight: "700",
    color: theme.textMuted,
    marginBottom: 8,
    letterSpacing: 0.5,
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
  saveBtn: {
    backgroundColor: theme.primary,
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  saveText: { color: "#000", fontSize: 15, fontWeight: "700" },
});
