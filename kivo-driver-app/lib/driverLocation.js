import * as Location from 'expo-location';
import { supabase } from './supabase';

let watchSub = null;

// Broadcast the driver's location. Used both during active trips
// AND while the driver is online (so nearby-filtering works).
export async function startLocationBroadcast(driverId) {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return { error: 'permission_denied' };

    await stopLocationBroadcast();

    // Write an immediate first fix so nearby search works right away
    try {
      const first = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      await supabase.from('drivers').update({
        current_latitude: first.coords.latitude,
        current_longitude: first.coords.longitude,
        location_updated_at: new Date().toISOString(),
      }).eq('id', driverId);
    } catch {}

    watchSub = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.Balanced, timeInterval: 8000, distanceInterval: 20 },
      async (pos) => {
        await supabase.from('drivers').update({
          current_latitude: pos.coords.latitude,
          current_longitude: pos.coords.longitude,
          location_updated_at: new Date().toISOString(),
        }).eq('id', driverId);
      }
    );
    return { success: true };
  } catch (err) {
    return { error: err.message };
  }
}

export async function stopLocationBroadcast() {
  if (watchSub) { watchSub.remove(); watchSub = null; }
}
