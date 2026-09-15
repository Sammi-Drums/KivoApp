import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, TextInput, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { theme } from '../theme/colors';

export default function RatingModal({ visible, trip, passengerId, onClose, onRated }) {
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (stars === 0) { Alert.alert('Pick a rating', 'Please tap the stars to rate.'); return; }
    setSubmitting(true);
    const { error } = await supabase.from('ratings').insert({
      trip_id: trip.id, driver_id: trip.driver_id, passenger_id: passengerId,
      rating: stars, comment: comment.trim() || null,
    });
    setSubmitting(false);
    if (error) {
      if (error.code === '23505') { Alert.alert('Already rated', 'You already rated this trip.'); onClose(); return; }
      Alert.alert('Failed', error.message); return;
    }
    setStars(0); setComment('');
    onRated?.();
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>Rate your trip</Text>
          <Text style={styles.subtitle}>How was your ride?</Text>

          <View style={styles.stars}>
            {[1, 2, 3, 4, 5].map((n) => (
              <TouchableOpacity key={n} onPress={() => setStars(n)} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
                <Ionicons name={n <= stars ? 'star' : 'star-outline'} size={40} color={n <= stars ? theme.warn : theme.textMuted} />
              </TouchableOpacity>
            ))}
          </View>

          <TextInput
            style={styles.commentInput}
            value={comment}
            onChangeText={setComment}
            placeholder="Add a comment (optional)"
            placeholderTextColor={theme.textFaint}
            multiline
          />

          <TouchableOpacity style={styles.submitBtn} onPress={submit} disabled={submitting}>
            {submitting ? <ActivityIndicator color="#000" /> : <Text style={styles.submitText}>Submit Rating</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={styles.skipBtn} onPress={onClose}>
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: theme.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: theme.borderStrong, alignSelf: 'center', marginBottom: 20 },
  title: { fontSize: 22, fontWeight: '800', color: theme.text, textAlign: 'center' },
  subtitle: { fontSize: 14, color: theme.textMuted, textAlign: 'center', marginTop: 4, marginBottom: 24 },
  stars: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 24 },
  commentInput: { backgroundColor: theme.bg, borderWidth: 1, borderColor: theme.borderStrong, borderRadius: 12, padding: 14, color: theme.text, fontSize: 15, minHeight: 80, textAlignVertical: 'top', marginBottom: 20 },
  submitBtn: { backgroundColor: theme.primary, padding: 16, borderRadius: 12, alignItems: 'center' },
  submitText: { color: '#000', fontSize: 15, fontWeight: '700' },
  skipBtn: { padding: 14, alignItems: 'center' },
  skipText: { color: theme.textMuted, fontSize: 14 },
});
