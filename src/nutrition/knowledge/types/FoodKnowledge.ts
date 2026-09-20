export interface GoalCompatibilityRating {
  level: 'Excellent' | 'Good' | 'Moderate' | 'Poor';
  reason: string;
}

export interface PreparationEffect {
  nutritionImpact: string;
  calorieImpact: string;
  healthImpact: string;
  recommendationScore: number;
}

export interface PortionMistake {
  recommendedPortion: string;
  commonMistake: string;
  coachingMessage: string;
  calorieImpact: string;
}

export interface AiCoachingTip {
  title: string;
  message: string;
  reason: string;
  priority: string;
  goal: string;
  trigger: string;
}

export interface CameraRecognition {
  rawAppearance: string[];
  cookedAppearance: string[];
  color: string[];
  texture: string[];
  shape: string[];
  servingStyle: string[];
  restaurantAppearance: string[];
  streetFoodAppearance: string[];
  commonGarnishes: string[];
  commonlyConfusedFoods: string[];
  confidence: 'High' | 'Medium' | 'Low';
}

export interface FoodRelationships {
  similarFoods: string[];
  betterAlternatives: string[];
  suggestedPairings: string[];
  foodsToLimitTogether: string[];
  sameCategory: string[];
  recommendedSideDishes: string[];
}

export interface SatietyAnalysis {
  satietyScore: number;
  digestionSpeed: string;
  energyDuration: string;
  hungerReturn: string;
}

export interface BudgetIntelligence {
  budgetScore: number;
  averageBonaberiPrice: string;
  cheapestSeason: string;
  expensiveSeason: string;
  studentFriendly: boolean;
  streetAvailability: string;
  restaurantAvailability: string;
}

export interface FoodRestrictions {
  vegetarian: boolean;
  vegan: boolean;
  halalCompatible: boolean;
  kosherCompatible: boolean;
  containsPork: boolean;
  containsAlcohol: boolean;
  containsGluten: boolean;
  containsDairy: boolean;
  containsEggs: boolean;
  containsNuts: boolean;
  containsSeafood: boolean;
  containsSoy: boolean;
}

export interface StorageIntelligence {
  shelfLife: string;
  fridge: string;
  freezer: string;
  roomTemperature: string;
  reheatingAdvice: string;
  foodSafety: string;
}

export interface MicronutrientHighlights {
  topVitamins: string[];
  topMinerals: string[];
  bioactiveCompounds: string[];
  mainBenefits: string[];
}

export interface FoodKnowledge {
  id: string;
  name: string;
  aliases: string[];
  searchKeywords: string[];
  scientificName?: string;
  category: string;
  foodType?: string;
  mealType: string[];
  country: string;
  regions: string[];
  
  servingSizes: {
    small?: string;
    medium: string;
    large?: string;
  };

  nutrition: {
    calories: number;
    protein: number;
    carbohydrates: number;
    fat: number;
    fiber: number;
    sugar: number;
    sodium: number;
    potassium?: number;
    calcium?: number;
    iron?: number;
    magnesium?: number;
    zinc?: number;
    vitaminA?: number;
    vitaminC?: number;
    vitaminD?: number;
    vitaminB12?: number;
    folate?: number;
    glycemicIndex?: number;
    glycemicLoad?: number;
    waterContent?: string;
  };

  scores: {
    healthScore: number;
    satietyScore: number;
    confidenceLevel: 'High' | 'Medium-High' | 'Medium' | 'Low';
  };

  micronutrientHighlights?: MicronutrientHighlights;
  healthBenefits?: string[];
  healthRisks?: string[];

  goalCompatibility: {
    weightLoss: GoalCompatibilityRating;
    weightGain: GoalCompatibilityRating;
    muscleBuilding: GoalCompatibilityRating;
    weightMaintenance: GoalCompatibilityRating;
    healthyEating: GoalCompatibilityRating;
    diabetesFriendly: GoalCompatibilityRating;
    heartHealthy: GoalCompatibilityRating;
    highBloodPressure?: GoalCompatibilityRating;
    studentBudget?: GoalCompatibilityRating;
    sportsPerformance?: GoalCompatibilityRating;
    recovery?: GoalCompatibilityRating;
    satiety?: GoalCompatibilityRating;
  };

  foodIntelligence: {
    bestFor: string[];
    goodSourceOf: string[];
    concerns: string[];
    healthierPreparation: string[];
    recommendedFrequency: string;
  };

  foodRelationships: FoodRelationships;

  preparationIntelligence: {
    boiled?: PreparationEffect;
    steamed?: PreparationEffect;
    grilled?: PreparationEffect;
    roasted?: PreparationEffect;
    fried?: PreparationEffect;
    smoked?: PreparationEffect;
    baked?: PreparationEffect;
    raw?: PreparationEffect;
    deepFried?: PreparationEffect;
    pressureCooked?: PreparationEffect;
    airFried?: PreparationEffect;
  };

  mealIntelligence: {
    breakfast: boolean;
    lunch: boolean;
    dinner: boolean;
    snack: boolean;
    festival: boolean;
    streetFood: boolean;
    preWorkout?: boolean;
    postWorkout?: boolean;
    lateNight?: boolean;
    examStudy?: boolean;
    quickMeal?: boolean;
    heavyMeal?: boolean;
  };

  portionIntelligence: PortionMistake[];

  satietyAnalysis?: SatietyAnalysis;
  budgetIntelligence?: BudgetIntelligence;
  foodTags?: string[];
  foodRestrictions?: FoodRestrictions;
  storage?: StorageIntelligence;

  aiCoaching: AiCoachingTip[];

  cameraRecognition: CameraRecognition;

  metadata: {
    researchVersion: string;
    lastUpdated: string;
    dataCompleteness: number;
    estimatedFields: string[];
    primarySources: string[];
    validationStatus?: 'PASS' | 'FAIL' | 'WARNING';
    revisionHistory?: { date: string, changes: string }[];
  };
}
