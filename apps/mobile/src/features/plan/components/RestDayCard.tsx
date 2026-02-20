import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { FontAwesomeIcon } from "@fortawesome/react-native-fontawesome";
import { faBed, faMoon } from "@fortawesome/free-solid-svg-icons";
import { theme } from "../../../theme/theme";

export function RestDayCard() {
    return (
        <View style={styles.card}>
            <View style={styles.illustrationWrap}>
                <View style={styles.glow} />
                <FontAwesomeIcon icon={faMoon as any} size={64} color={theme.colors.info} />
            </View>
            <Text style={styles.title}>Recovery Mode</Text>
            <Text style={styles.copy}>
                Growth happens when you rest. Take this day to recover and prepare for the next challenge.
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: theme.colors.surfaceElevated,
        borderRadius: theme.radius.xl,
        padding: theme.spacing.xl,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: theme.colors.borderSubtle,
        minHeight: 280,
        shadowColor: theme.colors.info,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 24,
        elevation: 10,
        overflow: "hidden",
        marginTop: theme.spacing.md
    },
    illustrationWrap: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: "rgba(10, 132, 255, 0.1)",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: theme.spacing.lg,
        position: "relative"
    },
    glow: {
        position: "absolute",
        width: "100%",
        height: "100%",
        borderRadius: 60,
        backgroundColor: theme.colors.info,
        opacity: 0.2,
        transform: [{ scale: 1.5 }]
    },
    title: {
        color: theme.colors.textPrimary,
        fontSize: theme.typography.title1,
        fontWeight: "900",
        letterSpacing: -0.5,
        marginBottom: theme.spacing.sm
    },
    copy: {
        color: theme.colors.textSecondary,
        fontSize: theme.typography.body,
        textAlign: "center",
        lineHeight: 24,
        paddingHorizontal: theme.spacing.md
    }
});
