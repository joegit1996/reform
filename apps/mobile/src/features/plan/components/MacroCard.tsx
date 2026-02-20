import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { theme } from "../../../theme/theme";

type Props = {
    protein: number;
    proteinTarget: number;
    carbs: number;
    carbsTarget: number;
    fats: number;
    fatsTarget: number;
};

export function MacroCard({
    protein,
    proteinTarget,
    carbs,
    carbsTarget,
    fats,
    fatsTarget
}: Props) {
    const pPercent = proteinTarget > 0 ? Math.min(100, (protein / proteinTarget) * 100) : 0;
    const cPercent = carbsTarget > 0 ? Math.min(100, (carbs / carbsTarget) * 100) : 0;
    const fPercent = fatsTarget > 0 ? Math.min(100, (fats / fatsTarget) * 100) : 0;

    return (
        <View style={styles.card}>
            <Text style={styles.title}>MACROS</Text>

            <View style={styles.barsContainer}>
                <View style={styles.macroRow}>
                    <Text style={styles.macroLabel}>P</Text>
                    <View style={styles.track}>
                        <View style={[styles.fill, { width: `${Math.max(5, pPercent)}%`, backgroundColor: theme.colors.info }]} />
                    </View>
                    <Text style={styles.macroValue}>{Math.round(protein)}g</Text>
                </View>

                <View style={styles.macroRow}>
                    <Text style={styles.macroLabel}>C</Text>
                    <View style={styles.track}>
                        <View style={[styles.fill, { width: `${Math.max(5, cPercent)}%`, backgroundColor: theme.colors.success }]} />
                    </View>
                    <Text style={styles.macroValue}>{Math.round(carbs)}g</Text>
                </View>

                <View style={styles.macroRow}>
                    <Text style={styles.macroLabel}>F</Text>
                    <View style={styles.track}>
                        <View style={[styles.fill, { width: `${Math.max(5, fPercent)}%`, backgroundColor: theme.colors.warning }]} />
                    </View>
                    <Text style={styles.macroValue}>{Math.round(fats)}g</Text>
                </View>
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
        fontWeight: "800",
        textTransform: "uppercase",
        letterSpacing: 0.5,
        marginBottom: theme.spacing.xs
    },
    barsContainer: {
        gap: 6,
        marginTop: 4
    },
    macroRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8
    },
    macroLabel: {
        color: theme.colors.textMuted,
        fontSize: theme.typography.tiny,
        fontWeight: "800",
        width: 12
    },
    track: {
        flex: 1,
        height: 6,
        borderRadius: theme.radius.pill,
        backgroundColor: theme.colors.surfaceHighlighted,
        overflow: "hidden"
    },
    fill: {
        height: "100%",
        borderRadius: theme.radius.pill
    },
    macroValue: {
        color: theme.colors.textPrimary,
        fontSize: theme.typography.tiny,
        fontWeight: "700",
        width: 24,
        textAlign: "right"
    }
});
