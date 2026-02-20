const fs = require('fs');

const path = '/Users/joe/Reform-Codex/apps/mobile/src/features/plan/PlanHomeScreen.tsx';
let source = fs.readFileSync(path, 'utf8');

const newStyles = `const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background
  },
  content: {
    padding: theme.spacing.lg,
    gap: theme.spacing.lg
  },
  weekNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.radius.pill,
    padding: theme.spacing.xs,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle
  },
  navButton: {
    backgroundColor: theme.colors.surfaceHighlighted,
    borderRadius: theme.radius.pill,
    paddingVertical: 10,
    paddingHorizontal: 16
  },
  navButtonDisabled: {
    opacity: 0.4
  },
  navButtonText: {
    color: theme.colors.textPrimary,
    fontWeight: "700",
    fontSize: theme.typography.caption
  },
  kicker: {
    color: theme.colors.accent,
    fontSize: theme.typography.caption,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginTop: theme.spacing.xs
  },
  buildMarker: {
    color: "#7FB6FF",
    fontSize: 12,
    fontWeight: "700"
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.title2,
    fontWeight: "800"
  },
  carousel: {
    gap: theme.spacing.md,
    paddingRight: theme.spacing.xxl
  },
  carouselItem: {
    width: 300
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: theme.spacing.sm
  },
  sectionHeaderActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  sectionTitle: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.title2,
    fontWeight: "800",
    flex: 1
  },
  dayState: {
    color: theme.colors.textMuted,
    fontWeight: "800",
    fontSize: theme.typography.caption,
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  dayStateDone: {
    color: theme.colors.success
  },
  editToggle: {
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle
  },
  editToggleActive: {
    backgroundColor: theme.colors.accentLight,
    borderColor: theme.colors.accent
  },
  editToggleText: {
    color: theme.colors.textPrimary,
    fontWeight: "700",
    fontSize: theme.typography.caption
  },
  dayNavScroll: {
    flexDirection: "row",
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    marginBottom: theme.spacing.sm
  },
  dayPill: {
    backgroundColor: theme.colors.surfaceElevated,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle
  },
  dayPillActive: {
    backgroundColor: theme.colors.accentLight,
    borderColor: theme.colors.accent
  },
  dayPillText: {
    color: theme.colors.textSecondary,
    fontWeight: "800",
    fontSize: theme.typography.caption
  },
  dayPillTextActive: {
    color: theme.colors.textPrimary
  },
  protocol: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.body,
    lineHeight: 24,
    paddingHorizontal: theme.spacing.xs
  },
  list: {
    gap: theme.spacing.md
  },
  secondaryButton: {
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.radius.pill,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle
  },
  secondaryButtonText: {
    color: theme.colors.textPrimary,
    fontWeight: "800",
    fontSize: theme.typography.body
  },
  noticeCard: {
    backgroundColor: theme.colors.dangerLight,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: "rgba(255, 59, 48, 0.3)",
    padding: theme.spacing.lg,
    gap: theme.spacing.sm
  },
  noticeTitle: {
    color: theme.colors.textPrimary,
    fontWeight: "800",
    fontSize: theme.typography.subtitle
  },
  noticeText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.body,
    lineHeight: 22
  },
  noticeButton: {
    alignSelf: "flex-start",
    backgroundColor: theme.colors.danger,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginTop: theme.spacing.sm
  },
  noticeButtonText: {
    color: "#FFFFFF",
    fontWeight: "800"
  },
  restCard: {
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.xl,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    minHeight: 200,
    shadowColor: theme.colors.accent,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10
  },
  restTitle: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.title1,
    fontWeight: "900",
    letterSpacing: -0.5
  },
  restCopy: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.body,
    marginTop: theme.spacing.sm,
    textAlign: "center",
    lineHeight: 24
  },
  manageScreen: {
    flex: 1,
    backgroundColor: theme.colors.background,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
    paddingTop: 60
  },
  manageTitle: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.title2,
    fontWeight: "900",
    marginBottom: theme.spacing.sm
  },
  targetRow: {
    backgroundColor: theme.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    borderRadius: theme.radius.lg,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: theme.spacing.sm
  },
  targetRowSelected: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.accentLight
  },
  targetText: {
    color: theme.colors.textPrimary,
    fontWeight: "700",
    fontSize: theme.typography.body
  },
  manageActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: theme.spacing.md,
    marginTop: theme.spacing.md,
    paddingBottom: 40
  },
  modalScreen: {
    flex: 1,
    backgroundColor: theme.colors.background
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomColor: theme.colors.borderSubtle,
    borderBottomWidth: 1,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: 16,
    backgroundColor: "rgba(9, 10, 15, 0.9)"
  },
  inlineClose: {
    backgroundColor: theme.colors.surfaceHighlighted,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 16,
    paddingVertical: 10
  },
  inlineCloseText: {
    color: theme.colors.textPrimary,
    fontWeight: "800",
    fontSize: theme.typography.caption
  },
  mealCard: {
    backgroundColor: theme.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    gap: 8
  },
  mealDateText: {
    color: theme.colors.textPrimary,
    fontWeight: "800",
    fontSize: theme.typography.subtitle
  },
  mealMacroText: {
    color: theme.colors.accent,
    fontWeight: "700",
    fontSize: theme.typography.caption,
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  mealItemText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.body,
    lineHeight: 22
  },
  closeButton: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 16,
    paddingVertical: 10
  },
  closeText: {
    color: theme.colors.textSecondary,
    fontWeight: "800"
  },
  modalTitle: {
    color: theme.colors.textPrimary,
    fontWeight: "900",
    fontSize: theme.typography.title2,
    flex: 1,
    paddingRight: theme.spacing.sm
  },
  modalContent: {
    padding: theme.spacing.lg,
    gap: 16,
    backgroundColor: theme.colors.background
  },
  modalDescription: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.body,
    lineHeight: 24
  },
  modalSection: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.title2,
    fontWeight: "900",
    marginTop: theme.spacing.md
  },
  editor: {
    gap: 12,
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.radius.lg,
    borderColor: theme.colors.borderSubtle,
    borderWidth: 1,
    padding: 16
  },
  input: {
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.radius.lg,
    color: theme.colors.textPrimary,
    borderColor: theme.colors.borderSubtle,
    borderWidth: 1,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: 14,
    fontSize: theme.typography.body,
    fontWeight: "600"
  }
});`;

const match = source.match(/const styles = StyleSheet\.create\({[\s\S]*\}\);\n/);
if (match) {
  source = source.replace(match[0], newStyles + '\n');
  fs.writeFileSync(path, source);
  console.log('Successfully updated styles array.');
} else {
  console.log('Could not find styles block.');
}
