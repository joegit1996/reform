import { StyleSheet, Text, View } from "react-native";
import { theme } from "../../../theme/theme";

type Props = {
  title: string;
  value: string;
  percent: number;
};

export function ProgressCard({ title, value, percent }: Props) {
  return (
    <View style={[styles.card, theme.shadows.md]}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.value} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${Math.max(0, Math.min(100, percent))}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    minHeight: 100,
    justifyContent: "space-between"
  },
  title: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.caption,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  value: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.title2,
    fontWeight: "800",
    marginTop: theme.spacing.xs,
    marginBottom: theme.spacing.sm
  },
  track: {
    height: 6,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surfaceHighlighted,
    overflow: "hidden"
  },
  fill: {
    height: "100%",
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius.pill
  }
});
