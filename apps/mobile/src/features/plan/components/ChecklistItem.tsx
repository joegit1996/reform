import { Pressable, StyleSheet, Text, View } from "react-native";
import { FontAwesomeIcon } from "@fortawesome/react-native-fontawesome";
import {
  faCheckCircle,
  faCircle,
  faArrowUp,
  faArrowDown,
  faTimes,
  faPlus,
  faDumbbell,
  faStopwatch,
  faRoad,
  faStairs
} from "@fortawesome/free-solid-svg-icons";
import { theme } from "../../../theme/theme";

type PreviewRow = {
  set: number;
  reps: string;
  weight: string;
  last: string;
  done: boolean;
};

type Props = {
  index: number;
  name: string;
  description: string;
  pills: string[];
  done: boolean;
  onPress: () => void;
  previewRows?: PreviewRow[];
  isCardio?: boolean;
  isStairmaster?: boolean;
  weightUnitLabel?: string;
  distanceUnitLabel?: string;
  weightInputs?: Record<number, string>;
  repsInputs?: Record<number, string>;
  onWeightChange?: (setNumber: number, value: string) => void;
  onRepsChange?: (setNumber: number, value: string) => void;
  onSaveSet?: (setNumber: number) => void;
  cardioDuration?: string;
  cardioSecondary?: string;
  cardioPace?: string;
  cardioLast?: string;
  onCardioDurationChange?: (value: string) => void;
  onCardioSecondaryChange?: (value: string) => void;
  onCardioPaceChange?: (value: string) => void;
  onSaveCardio?: () => void;
  isEditMode?: boolean;
  onAddSet?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onDeleteSet?: (setNumber: number) => void;
  showReorderControls?: boolean;
  onRemoveExercise?: () => void;
};

function NumericStepper({
  value,
  onChange,
  unit,
  step = 1,
  min = 0,
  isEditMode
}: {
  value: string;
  onChange: (v: string) => void;
  unit: string;
  step?: number;
  min?: number;
  isEditMode?: boolean;
}) {
  const current = value ? Number(value) : 0;

  if (isEditMode) {
    return (
      <View style={[styles.stepperContainer, styles.stepperDisabled]}>
        <Text style={styles.stepperValueText}>{value || "0"}</Text>
        <Text style={styles.stepperUnitText}>{unit}</Text>
      </View>
    );
  }

  return (
    <View style={styles.stepperContainer}>
      <Pressable
        style={styles.stepperBtn}
        onPress={() => onChange(String(Math.max(min, current - step)))}
      >
        <Text style={styles.stepperBtnText}>-</Text>
      </Pressable>
      <View style={styles.stepperValueArea}>
        <Text style={styles.stepperValueText}>{value || "0"}</Text>
        <Text style={styles.stepperUnitText}>{unit}</Text>
      </View>
      <Pressable
        style={styles.stepperBtn}
        onPress={() => onChange(String(current + step))}
      >
        <Text style={styles.stepperBtnText}>+</Text>
      </Pressable>
    </View>
  );
}

export function ChecklistItem({
  index,
  name,
  description,
  pills,
  done,
  onPress,
  previewRows,
  isCardio,
  isStairmaster,
  weightUnitLabel = "lb",
  distanceUnitLabel = "km",
  weightInputs,
  repsInputs,
  onWeightChange,
  onRepsChange,
  onSaveSet,
  cardioDuration,
  cardioSecondary,
  cardioPace,
  onCardioDurationChange,
  onCardioSecondaryChange,
  onSaveCardio,
  isEditMode,
  onAddSet,
  onMoveUp,
  onMoveDown,
  onDeleteSet,
  showReorderControls,
  onRemoveExercise
}: Props) {

  const icon = isCardio ? (isStairmaster ? faStairs : faRoad) : faDumbbell;

  return (
    <View style={[styles.card, done && styles.cardDone]}>
      <Pressable onPress={onPress} style={styles.header}>
        <View style={styles.headerTitleArea}>
          <View style={styles.iconBox}>
            <FontAwesomeIcon icon={icon as any} size={16} color={theme.colors.accent} />
          </View>
          <View>
            <Text style={styles.name}>{name}</Text>
            <Text style={styles.index}>Exercise {index}</Text>
          </View>
        </View>

        <View style={styles.headerActions}>
          {showReorderControls ? (
            <>
              <Pressable style={styles.actionBtn} onPress={onMoveUp}>
                <FontAwesomeIcon icon={faArrowUp as any} size={14} color={theme.colors.textSecondary} />
              </Pressable>
              <Pressable style={styles.actionBtn} onPress={onMoveDown}>
                <FontAwesomeIcon icon={faArrowDown as any} size={14} color={theme.colors.textSecondary} />
              </Pressable>
            </>
          ) : null}
          <Pressable
            style={[styles.primaryActionBtn, done && styles.primaryActionBtnDone]}
            onPress={() => {
              if (isEditMode) {
                onRemoveExercise?.();
                return;
              }
              onAddSet?.();
            }}
          >
            <FontAwesomeIcon
              icon={(isEditMode ? faTimes : faPlus) as any}
              size={16}
              color={done && !isEditMode ? theme.colors.success : theme.colors.textPrimary}
            />
          </Pressable>
        </View>
      </Pressable>

      {description ? (
        <Text style={styles.description} numberOfLines={2}>{description}</Text>
      ) : null}

      {previewRows?.length ? (
        <View style={styles.setsWrapper}>
          {previewRows.map((row) => (
            <View key={`${name}-${row.set}`} style={[styles.setRow, row.done && styles.setRowDone]}>
              <View style={styles.setNumberBox}>
                <Text style={styles.setNumberText}>{row.set}</Text>
              </View>

              <View style={styles.inputsArea}>
                {isCardio ? (
                  <>
                    <NumericStepper
                      value={cardioDuration ?? ""}
                      onChange={(v) => onCardioDurationChange?.(v)}
                      unit="min"
                      step={5}
                      isEditMode={isEditMode}
                    />
                    <NumericStepper
                      value={cardioSecondary ?? ""}
                      onChange={(v) => onCardioSecondaryChange?.(v)}
                      unit={isStairmaster ? "flr" : distanceUnitLabel}
                      step={isStairmaster ? 10 : 0.5}
                      isEditMode={isEditMode}
                    />
                  </>
                ) : (
                  <>
                    <NumericStepper
                      value={repsInputs?.[row.set] ?? row.reps}
                      onChange={(v) => onRepsChange?.(row.set, v)}
                      unit="reps"
                      step={1}
                      isEditMode={isEditMode}
                    />
                    <NumericStepper
                      value={weightInputs?.[row.set] ?? row.weight}
                      onChange={(v) => onWeightChange?.(row.set, v)}
                      unit={weightUnitLabel}
                      step={5}
                      isEditMode={isEditMode}
                    />
                  </>
                )}
              </View>

              <Pressable
                style={styles.checkBtn}
                onPress={() => {
                  if (isEditMode) {
                    onDeleteSet?.(row.set);
                    return;
                  }
                  if (isCardio) onSaveCardio?.();
                  else onSaveSet?.(row.set);
                }}
              >
                <FontAwesomeIcon
                  icon={(isEditMode ? faTimes : (row.done ? faCheckCircle : faCircle)) as any}
                  size={26}
                  color={isEditMode ? theme.colors.danger : (row.done ? theme.colors.success : theme.colors.border)}
                />
              </Pressable>
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.pillWrap}>
          {pills.map((pill) => (
            <View key={pill} style={styles.pill}>
              <Text style={styles.pillText}>{pill}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    marginBottom: theme.spacing.md,
    overflow: "hidden"
  },
  cardDone: {
    borderColor: theme.colors.successLight,
    backgroundColor: "rgba(0, 230, 118, 0.03)"
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: theme.spacing.sm
  },
  headerTitleArea: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: theme.colors.accentLight,
    alignItems: "center",
    justifyContent: "center"
  },
  name: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.subtitle,
    fontWeight: "800",
    letterSpacing: 0.2
  },
  index: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.caption,
    fontWeight: "600",
    marginTop: 2
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.surfaceHighlighted,
    alignItems: "center",
    justifyContent: "center"
  },
  primaryActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.surfaceHighlighted,
    alignItems: "center",
    justifyContent: "center"
  },
  primaryActionBtnDone: {
    backgroundColor: theme.colors.successLight
  },
  description: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.caption,
    lineHeight: 18,
    marginBottom: theme.spacing.md
  },
  setsWrapper: {
    gap: 8,
    marginTop: 8
  },
  setRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: 8,
    borderWidth: 1,
    borderColor: "transparent"
  },
  setRowDone: {
    backgroundColor: theme.colors.successLight,
    borderColor: "rgba(0,230,118,0.2)"
  },
  setNumberBox: {
    width: 36,
    alignItems: "center",
    justifyContent: "center"
  },
  setNumberText: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.body,
    fontWeight: "800"
  },
  inputsArea: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 12
  },
  checkBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center"
  },

  // Stepper Styles
  stepperContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.surfaceHighlighted,
    borderRadius: theme.radius.pill,
    flex: 1,
    height: 44,
    maxWidth: 130
  },
  stepperDisabled: {
    opacity: 0.6,
    justifyContent: "center"
  },
  stepperBtn: {
    width: 36,
    height: "100%",
    alignItems: "center",
    justifyContent: "center"
  },
  stepperBtnText: {
    color: theme.colors.textSecondary,
    fontSize: 20,
    fontWeight: "600",
    marginTop: -2
  },
  stepperValueArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  stepperValueText: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: "800"
  },
  stepperUnitText: {
    color: theme.colors.textMuted,
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    marginTop: -2
  },

  // Empty state Pills
  pillWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8
  },
  pill: {
    backgroundColor: theme.colors.surfaceHighlighted,
    borderRadius: theme.radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  pillText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.caption,
    fontWeight: "600"
  }
});
