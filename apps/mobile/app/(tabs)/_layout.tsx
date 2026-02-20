import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { theme } from "../../src/theme/theme";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: theme.colors.accent,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarStyle: {
          backgroundColor: theme.colors.surfaceElevated,
          borderTopColor: theme.colors.border,
          height: 72,
          paddingTop: 6
        },
        tabBarLabelStyle: {
          fontWeight: "700",
          fontSize: 11
        },
        tabBarItemStyle: route.name === "log" ? { transform: [{ translateY: -6 }] } : undefined,
        tabBarIcon: ({ color, size }) => {
          const map: Record<string, keyof typeof Ionicons.glyphMap> = {
            index: "barbell-outline",
            articles: "book-outline",
            log: "add-circle",
            chat: "chatbubbles-outline",
            profile: "person-circle-outline"
          };
          const iconName = map[route.name] ?? "ellipse-outline";
          if (route.name === "log") {
            return (
              <Ionicons
                name={iconName}
                size={34}
                color={theme.colors.accent}
              />
            );
          }
          return <Ionicons name={iconName} size={size} color={color} />;
        }
      })}
    >
      <Tabs.Screen name="index" options={{ title: "Plan" }} />
      <Tabs.Screen name="articles" options={{ title: "Articles" }} />
      <Tabs.Screen name="log" options={{ title: "Log" }} />
      <Tabs.Screen name="chat" options={{ title: "Chat" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
    </Tabs>
  );
}
