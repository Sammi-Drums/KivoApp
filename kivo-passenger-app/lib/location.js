import * as Location from "expo-location";

export async function getCurrentLocation() {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") return { error: "permission_denied" };
    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    return { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
  } catch (err) {
    return { error: err.message || "unknown" };
  }
}

// Reverse geocode: coordinates -> readable address (no country restriction)
export async function reverseGeocode(lat, lon) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=16&accept-language=en`;
    const res = await fetch(url, {
      headers: { "User-Agent": "KivoRides/1.0" },
    });
    const data = await res.json();
    if (data.display_name)
      return data.display_name
        .split(",")
        .map((s) => s.trim())
        .slice(0, 3)
        .join(", ");
    return null;
  } catch {
    return null;
  }
}

// Search an address -> list of results (NO country restriction, so it works anywhere)
export async function searchPlaces(query) {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(query)}&limit=5&accept-language=en`;
    const res = await fetch(url, {
      headers: { "User-Agent": "KivoRides/1.0" },
    });
    const data = await res.json();
    return (data || []).map((item) => ({
      latitude: parseFloat(item.lat),
      longitude: parseFloat(item.lon),
      name: item.display_name.split(",").slice(0, 2).join(", "),
      fullName: item.display_name,
    }));
  } catch {
    return [];
  }
}

// Get real driving route between two points using OSRM (free, no key)
// Returns { distanceKm, durationMin, coordinates: [{latitude, longitude}, ...] }
export async function getRoute(fromLat, fromLon, toLat, toLon) {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${fromLon},${fromLat};${toLon},${toLat}?overview=full&geometries=geojson`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.routes && data.routes[0]) {
      const route = data.routes[0];
      const coordinates = route.geometry.coordinates.map(([lon, lat]) => ({
        latitude: lat,
        longitude: lon,
      }));
      return {
        distanceKm: Math.round((route.distance / 1000) * 10) / 10,
        durationMin: Math.round(route.duration / 60),
        coordinates,
      };
    }
    return null;
  } catch {
    return null;
  }
}

// Straight-line fallback if routing fails
export function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1),
    dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return (
    Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 1.4 * 10) /
    10
  );
}
