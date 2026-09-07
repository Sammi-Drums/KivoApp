import * as Location from 'expo-location';

export async function getCurrentLocation() {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return { error: 'permission_denied' };
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
  } catch (err) {
    return { error: err.message || 'unknown' };
  }
}

export async function reverseGeocode(lat, lon) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=16&accept-language=en`;
    const res = await fetch(url, { headers: { 'User-Agent': 'KivoRides/1.0' } });
    const data = await res.json();
    if (data.display_name) return data.display_name.split(',').map(s => s.trim()).slice(0, 3).join(', ');
    return null;
  } catch { return null; }
}

export async function forwardGeocode(address) {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(address)}&countrycodes=cm&limit=1&accept-language=en`;
    const res = await fetch(url, { headers: { 'User-Agent': 'KivoRides/1.0' } });
    const data = await res.json();
    if (data && data.length > 0) return { latitude: parseFloat(data[0].lat), longitude: parseFloat(data[0].lon) };
    return null;
  } catch { return null; }
}

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function estimateRoadDistance(lat1, lon1, lat2, lon2) {
  return haversine(lat1, lon1, lat2, lon2) * 1.4;
}
