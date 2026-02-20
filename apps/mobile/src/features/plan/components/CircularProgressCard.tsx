import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, G } from "react-native-svg";
import { theme } from "../../../theme/theme";

type Props = {
    title: string;
    value: string;
    percent: number;
};

export function CircularProgressCard({ title, value, percent }: Props) {
    const size = 64;
    const strokeWidth = 6;
    const center = size / 2;
    const radius = center - strokeWidth / 2;
    const circumference = 2 * Math.PI * radius;
    const progress = Math.max(0, Math.min(100, percent)) / 100;
    const strokeDashoffset = circumference - progress * circumference;

    return (
        <View style={styles.card}>
            <View style={styles.textContainer}>
                <Text style={styles.title}>{title}</Text>
                <Text style={styles.value} numberOfLines={1} adjustsFontSizeToFit>
                    {value}
                </Text>
            </View>

            <View style={styles.chartContainer}>
                <Svg width={size} height={size}>
                    <G rotation="-90" origin={`${center}, ${center}`}>
                        <Circle
                            cx={center}
                            cy={center}
                            r={radius}
                            stroke={theme.colors.surfaceHighlighted}
                            strokeWidth={strokeWidth}
                            fill="none"
                        />
                        <Circle
                            cx={center}
                            cy={center}
                            r={radius}
                            stroke={theme.colors.accent}
                            strokeWidth={strokeWidth}
                            fill="none"
                            strokeDasharray={circumference}
                            strokeDashoffset={strokeDashoffset}
                            strokeLinecap="round"
                        />
                    </G>
                </Svg>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: theme.colors.surfaceElevated,
        borderRadius: theme.radius.lg,
        padding: theme.spacing.md,
        borderWidth: 1,
        borderColor: theme.colors.borderSubtle,
        minHeight: 100,
        justifyContent: "space-between"
    },
    textContainer: {
        flex: 1,
        justifyContent: "center",
        paddingRight: theme.spacing.sm
    },
    title: {
        color: theme.colors.textSecondary,
        fontSize: theme.typography.caption,
        fontWeight: "800",
        textTransform: "uppercase",
        letterSpacing: 0.5,
        marginBottom: theme.spacing.xs
    },
    value: {
        color: theme.colors.textPrimary,
        fontSize: theme.typography.title2,
        fontWeight: "800"
    },
    chartContainer: {
        width: 64,
        height: 64,
        alignItems: "center",
        justifyContent: "center"
    }
});
