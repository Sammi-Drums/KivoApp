import { useState } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme/colors';

export default function PasswordInput({ value, onChangeText, placeholder = 'Enter your password', editable = true, showStrength = false }) {
  const [visible, setVisible] = useState(false);
  return (
    <View>
      <View style={styles.wrap}>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.textFaint}
          secureTextEntry={!visible}
          editable={editable}
          autoCapitalize="none"
        />
        <TouchableOpacity style={styles.eye} onPress={() => setVisible(v => !v)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name={visible ? 'eye-off-outline' : 'eye-outline'} size={20} color={theme.textMuted} />
        </TouchableOpacity>
      </View>
      {showStrength && value.length > 0 && <StrengthMeter password={value} />}
    </View>
  );
}

function getStrength(password) {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  const weak = ['password', '12345678', 'qwerty', 'letmein'];
  if (weak.some(w => password.toLowerCase().includes(w))) score = 0;
  if (score <= 1) return { label: 'Weak', color: theme.danger, width: '25%' };
  if (score === 2) return { label: 'Fair', color: theme.warn, width: '50%' };
  if (score === 3) return { label: 'Good', color: theme.info, width: '75%' };
  return { label: 'Strong', color: theme.primary, width: '100%' };
}

function StrengthMeter({ password }) {
  const { label, color, width } = getStrength(password);
  return (
    <View style={styles.strengthWrap}>
      <View style={styles.strengthBar}><View style={[styles.strengthFill, { width, backgroundColor: color }]} /></View>
      <Text style={[styles.strengthLabel, { color }]}>{label}</Text>
    </View>
  );
}

export function isPasswordStrongEnough(password) {
  if (password.length < 8) return false;
  const weak = ['password', '12345678', 'qwerty', 'letmein'];
  if (weak.some(w => password.toLowerCase().includes(w))) return false;
  return true;
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.borderStrong, borderRadius: 12 },
  input: { flex: 1, padding: 16, color: theme.text, fontSize: 15 },
  eye: { padding: 14 },
  strengthWrap: { flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 10 },
  strengthBar: { flex: 1, height: 4, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' },
  strengthFill: { height: '100%', borderRadius: 2 },
  strengthLabel: { fontSize: 11, fontWeight: '700', minWidth: 44, textAlign: 'right' },
});
