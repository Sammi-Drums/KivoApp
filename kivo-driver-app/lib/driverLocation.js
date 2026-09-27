import * as Location from 'expo-location';
import { supabase } from './supabase';

let watchSub = null;

// Start broadcasting the driver's location every ~8 seconds while on an active trip
export async function startLocationBroadcast(driverId) {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return { error: 'permission_denied' };

    await stopLocationBroadcast(); // clear any previous watcher

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
