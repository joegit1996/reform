export type Sex = "male" | "female";
export type ActivityLevel = "sedentary" | "light" | "moderate" | "very_active" | "athlete";
export type FitnessGoal = "fat_loss" | "maintenance" | "muscle_gain";

export type NutritionInputs = {
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
  goal: FitnessGoal;
};

export type NutritionTargets = {
  maintenanceCalories: number;
  dailyCalories: number;
  proteinG: number;
  carbsG: number;
  fatsG: number;
  macroWeightKg: number;
};

const ACTIVITY_FACTOR: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  very_active: 1.725,
  athlete: 1.9
};

const GOAL_CALORIE_MULTIPLIER: Record<FitnessGoal, number> = {
  fat_loss: 0.8,
  maintenance: 1,
  muscle_gain: 1.1
};

const PROTEIN_PER_KG: Record<FitnessGoal, number> = {
  fat_loss: 2.1,
  maintenance: 1.8,
  muscle_gain: 2.2
};

const FAT_CALORIE_RATIO: Record<FitnessGoal, number> = {
  fat_loss: 0.3,
  maintenance: 0.28,
  muscle_gain: 0.25
};

const MIN_DAILY_CALORIES = 1200;

function getBmi(heightCm: number, weightKg: number): number {
  const heightM = heightCm / 100;
  return weightKg / (heightM * heightM);
}

function getMacroWeightKg(heightCm: number, weightKg: number): number {
  const bmi = getBmi(heightCm, weightKg);
  if (bmi <= 25) return weightKg;
  const heightM = heightCm / 100;
  const weightAtBmi25 = 25 * heightM * heightM;
  return weightAtBmi25 + 0.25 * (weightKg - weightAtBmi25);
}

export function calculateNutritionTargets(input: NutritionInputs): NutritionTargets {
  const bmr =
    input.sex === "male"
      ? 10 * input.weightKg + 6.25 * input.heightCm - 5 * input.age + 5
      : 10 * input.weightKg + 6.25 * input.heightCm - 5 * input.age - 161;

  const maintenanceCalories = Math.round(bmr * ACTIVITY_FACTOR[input.activityLevel]);
  const dailyCalories = Math.max(
    Math.round(maintenanceCalories * GOAL_CALORIE_MULTIPLIER[input.goal]),
    MIN_DAILY_CALORIES
  );

  const macroWeightKg = getMacroWeightKg(input.heightCm, input.weightKg);
  const proteinG = Math.round(macroWeightKg * PROTEIN_PER_KG[input.goal]);
  const minFatG = Math.round(macroWeightKg * 0.6);
  const fatByRatioG = Math.round((dailyCalories * FAT_CALORIE_RATIO[input.goal]) / 9);
  const fatsG = Math.max(minFatG, fatByRatioG);

  const proteinCalories = proteinG * 4;
  const fatCalories = fatsG * 9;
  const remainingForCarbs = Math.max(dailyCalories - proteinCalories - fatCalories, 0);
  const carbsG = Math.round(remainingForCarbs / 4);

  return {
    maintenanceCalories,
    dailyCalories,
    proteinG: Math.max(proteinG, 0),
    carbsG: Math.max(carbsG, 0),
    fatsG: Math.max(fatsG, 0),
    macroWeightKg: Math.round(macroWeightKg * 10) / 10
  };
}
