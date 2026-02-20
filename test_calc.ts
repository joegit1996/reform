import { calculateNutritionTargets } from './apps/mobile/src/features/nutrition/calculator';

console.log(calculateNutritionTargets({ sex: "female", age: 40, heightCm: 155, weightKg: 100, activityLevel: "sedentary", goal: "fat_loss" }));
console.log(calculateNutritionTargets({ sex: "female", age: 25, heightCm: 160, weightKg: 50, activityLevel: "sedentary", goal: "fat_loss" }));
console.log(calculateNutritionTargets({ sex: "male", age: 30, heightCm: 180, weightKg: 80, activityLevel: "very_active", goal: "muscle_gain" }));
