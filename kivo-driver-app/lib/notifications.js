import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import { supabase } from "./supabase";

// How notifications behave when received while app is open
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});
// Register this device for push, save the token to the driver's row
export async function registerForPushNotifications(driverId) {
  try {
    if (!Device.isDevice)
      return { error: "Must use a physical device for push notifications." };

    // Android needs a notification channel with sound
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("rides", {
        name: "Ride Requests",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        sound: "default",
        lightColor: "#00D46A",
      });
    }

    // Ask permission
    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== "granted") return { error: "Permission not granted." };

    // Get the Expo push token
    const projectId = process.env.EXPO_PUBLIC_PROJECT_ID; // optional; Expo infers it in a build
    const tokenData = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    const token = tokenData.data;

    // Save it to the driver's row
    if (driverId && token) {
      const { error } = await supabase
        .from("drivers")
        .update({ push_token: token })
        .eq("id", driverId);
      if (error) throw error;
    }

    return { token };
  } catch (err) {
    return { error: err.message };
  }
}

// Listen for taps on notifications (navigate somewhere if needed)
export function addNotificationTapListener(callback) {
  return Notifications.addNotificationResponseReceivedListener(callback);
}
