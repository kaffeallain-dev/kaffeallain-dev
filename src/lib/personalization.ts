export function calculateDailyTarget(prof: any): number {
  if (!prof.age || !prof.heightCm || !prof.weightKg || !prof.sex || !prof.activityLevel) {
    // Return a default if incomplete
    return 2000;
  }

  let bmr = 0;
  if (prof.sex === 'Male') {
    bmr = 10 * prof.weightKg + 6.25 * prof.heightCm - 5 * prof.age + 5;
  } else {
    bmr = 10 * prof.weightKg + 6.25 * prof.heightCm - 5 * prof.age - 161;
  }

  let tdeeMultiplier = 1.2;
  switch (prof.activityLevel) {
    case 'Sedentary': tdeeMultiplier = 1.2; break;
    case 'Lightly Active': tdeeMultiplier = 1.375; break;
    case 'Moderately Active': tdeeMultiplier = 1.55; break;
    case 'Very Active': tdeeMultiplier = 1.725; break;
  }

  const tdee = bmr * tdeeMultiplier;
  let target = tdee;

  switch (prof.primaryGoal) {
    case 'Lose Weight': target = tdee * 0.85; break; // 15% deficit
    case 'Gain Weight': target = tdee * 1.15; break; // 15% surplus
    case 'Build Muscle': target = tdee * 1.10; break; // 10% surplus
    case 'Maintain Weight':
    case 'Eat Healthier':
      target = tdee; break;
  }

  return Math.round(target);
}

export function getProfileCompletion(prof: any): { percentage: number; missing: string[] } {
  let score = 0;
  const missing: string[] = [];
  
  if (prof?.primaryGoal) score += 10;
  else missing.push("Primary Goal");

  if (prof?.age) score += 10;
  else missing.push("Age");

  if (prof?.sex) score += 10;
  else missing.push("Gender");

  if (prof?.heightCm) score += 15;
  else missing.push("Height");

  if (prof?.weightKg) score += 15;
  else missing.push("Current Weight");

  if (prof?.activityLevel) score += 15;
  else missing.push("Activity Level");

  if (prof?.targetWeightKg) score += 15;
  else missing.push("Target Weight");

  if (prof?.healthConditions) score += 5;
  else missing.push("Health Conditions");

  if (prof?.preferences) score += 5;
  else missing.push("Preferences");

  return { percentage: score, missing };
}
