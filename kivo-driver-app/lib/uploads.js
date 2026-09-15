import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import { supabase } from "./supabase";

// Convert a local file URI to bytes for upload
async function fileToBytes(uri) {
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// Pick a PDF document
export async function pickDocument() {
  const result = await DocumentPicker.getDocumentAsync({
    type: "application/pdf",
    copyToCacheDirectory: true,
  });
  if (result.canceled || !result.assets?.[0]) return { cancelled: true };
  return { uri: result.assets[0].uri, name: result.assets[0].name };
}

// Pick a profile photo from gallery
export async function pickProfilePhoto() {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return { error: "Please allow photo access." };
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.7,
  });
  if (result.canceled || !result.assets?.[0]) return { cancelled: true };
  return { uri: result.assets[0].uri };
}

// Upload a file to the driver-documents bucket
// pathPrefix is used to organize: e.g. `${userId}/documents.pdf`
export async function uploadFile(uri, path, contentType) {
  try {
    const bytes = await fileToBytes(uri);
    const { error } = await supabase.storage
      .from("driver-documents")
      .upload(path, bytes, {
        contentType,
        upsert: true,
      });
    if (error) return { error: error.message };
    const {
      data: { publicUrl },
    } = supabase.storage.from("driver-documents").getPublicUrl(path);
    return { url: `${publicUrl}?t=${Date.now()}` };
  } catch (err) {
    return { error: err.message || "Upload failed" };
  }
}
