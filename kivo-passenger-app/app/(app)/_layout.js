import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../../theme/colors';

export default function AppTabsLayout() {
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.textMuted,
        tabBarStyle: {
          backgroundColor: theme.bg,
          borderTopColor: theme.border,
          borderTopWidth: 1,
          height: 64 + insets.bottom,
          paddingBottom: 8 + insets.bottom,
          paddingTop: 8,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: ({ color, focused }) => <Icon name={focused ? 'home' : 'home-outline'} color={color} /> }} />
      <Tabs.Screen name="book" options={{ title: 'Book', tabBarIcon: ({ color, focused }) => <Icon name={focused ? 'add-circle' : 'add-circle-outline'} color={color} /> }} />
      <Tabs.Screen name="history" options={{ title: 'History', tabBarIcon: ({ color, focused }) => <Icon name={focused ? 'time' : 'time-outline'} color={color} /> }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: ({ color, focused }) => <Icon name={focused ? 'person' : 'person-outline'} color={color} /> }} />
    </Tabs>
  );
}

function Icon({ name, color }) {
  return <View style={{ alignItems: 'center', justifyContent: 'center', height: 28 }}><Ionicons name={name} size={22} color={color} /></View>;
}
