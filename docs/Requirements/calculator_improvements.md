# Nutrition Calculator Improvements

## Overview
The current implementation in `calculator.ts` provides a solid baseline using the Mifflin-St Jeor equation for BMR, standard activity multipliers, and generally evidence-based protein targets. However, there are three primary fitness edge-cases that require addressing:

### 1. The "Overweight Skew" (Protein & Fat over-prescription)
**Issue:** Both protein and minimum fat requirements are currently tied exclusively to total `weightKg`. If an obese individual uses the calculator (e.g., 120kg male on a fat loss cut), they are prescribed wildly high protein (e.g., 252g) and fat, leaving them with almost zero carbohydrates. 
**Solution:** For individuals with a BMI over 25, use an "adjusted body weight" for macronutrient scaling to better approximate lean mass and ensure balanced macro splits.

### 2. High-Carb Fat Distribution
**Issue:** By permanently setting fat at `minFatG (0.8g/kg)` and dumping all remaining calories into carbohydrates, the diet heavily skews toward high carbs for normal-weight maintainers or muscle-gainers.
**Solution:** Calculate fat as a percentage of total daily calories (typically 25%-30% for hormonal health) and allocate the remainder to carbohydrates.

### 3. Missing Caloric Floors
**Issue:** Standard percentage deficits (e.g., 20% deficit for fat loss) can drop calories to dangerously low, unsafe metabolic baselines for shorter or highly sedentary individuals (especially women).
**Solution:** Enforce a hard dietary floor (e.g., `Math.max(calculatedCalories, 1200)` for women and 1500 for men).

## Implementation Target
File: `apps/mobile/src/features/nutrition/calculator.ts`

- Add `calorieFloor` conditional checks.
- Add BMI calculation `(weight / height^2)`.
- Apply adjusted body weight formula for cases where BMI > 25.
- Shift `fatsG` logic to percentage-based scaling off total calories.
