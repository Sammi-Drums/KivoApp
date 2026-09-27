import { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator, Keyboard } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import { UrlTile } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { getCurrentLocation, reverseGeocode, searchPlaces } from '../lib/location';
import { theme } from '../theme/colors';

// A reusable full-screen picker. Props:
//  title: "Set pickup" / "Set drop-off"
//  initialRegion: optional starting center
//  onConfirm: ({ latitude, longitude, address }) => void
//  onClose: () => void
export default function LocationPicker({ title, initialRegion, onConfirm, onClose }) {
  const mapRef = useRef(null);
  const [region, setRegion] = useState(initialRegion || {
    latitude: 5.9631, longitude: 10.1591, // Bamenda default
    latitudeDelta: 0.05, longitudeDelta: 0.05,
  });
  const [pin, setPin] = useState({ latitude: region.latitude, longitude: region.longitude });
  const [address, setAddress] = useState('');
  const [loadingAddr, setLoadingAddr] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);

  // When the pin moves, look up its address
  const updateAddress = async (lat, lon) => {
    setLoadingAddr(true);
    const addr = await reverseGeocode(lat, lon);
    setAddress(addr || `${lat.toFixed(5)}, ${lon.toFixed(5)}`);
    setLoadingAddr(false);
  };

  useEffect(() => { updateAddress(pin.latitude, pin.longitude); }, []);

  const handleRegionChange = (r) => {
    setRegion(r);
    // pin stays center of map
    setPin({ latitude: r.latitude, longitude: r.longitude });
  };

  const handleRegionChangeComplete = (r) => {
    updateAddress(r.latitude, r.longitude);
  };

  const useMyLocation = async () => {
    const res = await getCurrentLocation();
    if (res.error) return;
    const r = { latitude: res.latitude, longitude: res.longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 };
    mapRef.current?.animateToRegion(r, 500);
    setPin({ latitude: res.latitude, longitude: res.longitude });
    updateAddress(res.latitude, res.longitude);
  };

  const runSearch = async () => {
    if (!query.trim()) return;
    Keyboard.dismiss();
    setSearching(true);
    const found = await searchPlaces(query.trim());
    setResults(found);
    setSearching(false);
  };

  const pickResult = (item) => {
    const r = { latitude: item.latitude, longitude: item.longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 };
    mapRef.current?.animateToRegion(r, 500);
    setPin({ latitude: item.latitude, longitude: item.longitude });
    setAddress(item.name);
    setResults([]);
    setQuery('');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="close" size={26} color={theme.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{title}</Text>
        <View style={{ width: 26 }} />
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color={theme.textMuted} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Search for a place"
            placeholderTextColor={theme.textFaint}
            returnKeyType="search"
            onSubmitEditing={runSearch}
          />
          {searching ? <ActivityIndicator size="small" color={theme.primary} /> : query.length > 0 ? (
            <TouchableOpacity onPress={runSearch}><Text style={styles.goText}>Go</Text></TouchableOpacity>
          ) : null}
        </View>
        {results.length > 0 && (
          <View style={styles.results}>
            <FlatList
              data={results}
              keyExtractor={(_, i) => String(i)}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.resultRow} onPress={() => pickResult(item)}>
                  <Ionicons name="location-outline" size={18} color={theme.textMuted} />
                  <Text style={styles.resultText} numberOfLines={2}>{item.fullName}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        )}
      </View>

      {/* Map with center pin */}
      <View style={{ flex: 1 }}>
        <MapView
          ref={mapRef}
          provider={PROVIDER_DEFAULT}
          style={{ flex: 1 }}
          initialRegion={region}
          onRegionChange={handleRegionChange}
          onRegionChangeComplete={handleRegionChangeComplete}
        >
          {/* OSM tiles — free, no billing */}
          <UrlTile urlTemplate="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maximumZ={19} flipY={false} />
        </MapView>

        {/* Fixed center pin (the map moves under it) */}
        <View style={styles.centerPin} pointerEvents="none">
          <Ionicons name="location" size={44} color={theme.primary} />
        </View>

        {/* Use my location button */}
        <TouchableOpacity style={styles.myLocBtn} onPress={useMyLocation}>
          <Ionicons name="locate" size={22} color={theme.primary} />
        </TouchableOpacity>
      </View>

      {/* Bottom: address + confirm */}
      <View style={styles.bottom}>
        <Text style={styles.addrLabel}>SELECTED LOCATION</Text>
        <View style={styles.addrRow}>
          <Ionicons name="location" size={18} color={theme.primary} />
          {loadingAddr ? <ActivityIndicator size="small" color={theme.textMuted} /> : (
            <Text style={styles.addrText} numberOfLines={2}>{address}</Text>
          )}
        </View>
        <TouchableOpacity style={styles.confirmBtn} onPress={() => onConfirm({ latitude: pin.latitude, longitude: pin.longitude, address })}>
          <Text style={styles.confirmText}>Confirm {title.includes('pickup') ? 'Pickup' : 'Drop-off'}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  title: { fontSize: 18, fontWeight: '800', color: theme.text },
  searchWrap: { paddingHorizontal: 16, marginBottom: 8, zIndex: 10 },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.borderStrong, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  searchInput: { flex: 1, color: theme.text, fontSize: 15 },
  goText: { color: theme.primary, fontWeight: '700', fontSize: 14 },
  results: { backgroundColor: theme.surface, borderRadius: 12, marginTop: 6, borderWidth: 1, borderColor: theme.border, maxHeight: 220 },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderBottomWidth: 1, borderBottomColor: theme.divider },
  resultText: { flex: 1, color: theme.text, fontSize: 14 },
  centerPin: { position: 'absolute', top: '50%', left: '50%', marginLeft: -22, marginTop: -44 },
  myLocBtn: { position: 'absolute', bottom: 16, right: 16, width: 48, height: 48, borderRadius: 24, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.borderStrong, justifyContent: 'center', alignItems: 'center', elevation: 4 },
  bottom: { padding: 20, backgroundColor: theme.surface, borderTopWidth: 1, borderTopColor: theme.border },
  addrLabel: { fontSize: 11, fontWeight: '700', color: theme.textMuted, letterSpacing: 1, marginBottom: 8 },
  addrRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16, minHeight: 24 },
  addrText: { flex: 1, color: theme.text, fontSize: 15 },
  confirmBtn: { backgroundColor: theme.primary, padding: 16, borderRadius: 12, alignItems: 'center' },
  confirmText: { color: '#000', fontSize: 15, fontWeight: '700' },
});
