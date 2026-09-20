export type MealCategory = 'Breakfast' | 'Lunch' | 'Dinner' | 'Snacks';

export type FoodCategory = 
  | 'Soups' 
  | 'Starches' 
  | 'Breakfast Foods' 
  | 'Campus Meals' 
  | 'Frequently Eaten by Students'
  | 'Street Foods' 
  | 'Traditional Dishes' 
  | 'Snacks' 
  | 'Drinks' 
  | 'Fruits' 
  | 'Protein Sources'
  | 'Custom'
  | 'International'
  | string;

export type FoodType = 'Individual' | 'Combo' | 'Uncertain' | 'Duplicate';

export interface FoodItemTemplate {
  id: string;
  name: string;
  aliases?: string[];
  category?: FoodCategory;
  foodType?: FoodType;
  calories: number; // Base calories
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  sugar?: number;
  sodium?: number;
  servingSizeText: string; // e.g. "1 apple (182g)", "100g"
  confidenceLevel?: 'High' | 'Medium' | 'Low';
  preparationNotes?: string;
  popularity?: 'Very Common' | 'Common' | 'Occasional' | 'Rare';
  bestFor?: string[];
  concerns?: string[];
  pairings?: string[];
  alternatives?: string[];
  frequency?: 'Daily' | 'Occasional' | 'Rarely';
  satietyScore?: number;
  healthScore?: number;
  goalCompatibility?: Record<string, { level: 'Excellent' | 'Moderate' | 'Poor', reason: string }>;
}

export interface CompositeMealTemplate extends FoodItemTemplate {
  isComposite: true;
  components: string[]; // IDs or names of the component foods
}

export interface CustomFoodTemplate extends FoodItemTemplate {
  isCustom: boolean;
  createdAt: number;
}

export interface ConsumptionRecord {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  servings: number; 
  mealCategory: MealCategory;
  timestamp: number;
}

export interface UserProfile {
  age?: number;
  sex?: 'Male' | 'Female' | 'Other';
  heightCm?: number;
  weightKg?: number;
  startWeightKg?: number;
  targetWeightKg?: number;
  activityLevel?: 'Sedentary' | 'Lightly Active' | 'Moderately Active' | 'Very Active';
  primaryGoal?: 'Lose Weight' | 'Maintain Weight' | 'Gain Weight' | 'Build Muscle' | 'Eat Healthier';
  healthConditions?: string[];
  preferences?: string[];
}

export interface UserSettings {
  id: string;
  dailyGoal: number;
  profile?: UserProfile;
}


export interface FoodKnowledge {
  id: string;
  name: string;
  aliases: string[];
  scientificName: string;
  category: string;
  mealType: string[];
  country: string;
  regions: string[];
  servingSizes: {
    small: string;
    medium: string;
    large: string;
  };
  nutrition: {
    calories: number;
    protein: number;
    carbohydrates: number;
    fat: number;
    fiber: number;
    sugar: number;
    sodium: number;
    potassium: number;
    calcium: number;
    iron: number;
    magnesium: number;
    zinc: number;
    vitaminA: number;
    vitaminC: number;
    vitaminD: number;
    vitaminB12: number;
    glycemicIndex: number;
    waterContent: string;
  };
  healthScore: number;
  satietyScore: number;
  confidenceLevel: string;
  goalCompatibility: {
    weightLoss: { level: string, reason: string };
    weightGain: { level: string, reason: string };
    muscleBuilding: { level: string, reason: string };
    weightMaintenance: { level: string, reason: string };
    healthyEating: { level: string, reason: string };
    diabetesFriendly: { level: string, reason: string };
    heartHealthy: { level: string, reason: string };
  };
  foodIntelligence: {
    bestFor: string[];
    goodSourceOf: string[];
    concerns: string[];
    betterAlternatives: string[];
    healthierPreparation: string[];
    recommendedFrequency: string;
    suggestedPairings: string[];
  };
  preparationIntelligence: {
    boiled?: string;
    grilled?: string;
    steamed?: string;
    roasted?: string;
    fried?: string;
    smoked?: string;
    raw?: string;
  };
  mealIntelligence: {
    breakfast: boolean;
    lunch: boolean;
    dinner: boolean;
    snack: boolean;
    streetFood: boolean;
    festivalFood: boolean;
  };
  portionIntelligence: { title: string, description: string }[];
  aiCoaching: { title: string, message: string, reason: string }[];
}
