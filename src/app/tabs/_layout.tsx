
import { Tabs } from 'expo-router';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#B77F78',
        tabBarInactiveTintColor: '#B9A49C',
        tabBarStyle: {
          backgroundColor: '#FFF8F1',
          borderTopColor: '#F1E3DA',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarLabel: 'Home',
        }}
      />
    </Tabs>
  );
}
