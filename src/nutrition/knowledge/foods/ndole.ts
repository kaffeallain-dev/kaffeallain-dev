import { FoodKnowledge } from '../types/FoodKnowledge';

export const ndole: FoodKnowledge = {
  id: "ndole",
  name: "Ndolé",
  aliases: ["ndole", "bitterleaf soup", "ndole with meat"],
  searchKeywords: ["bitterleaf", "peanuts", "crayfish", "cameroon soup", "sawa"],
  scientificName: "Vernonia amygdalina",
  category: "Soups",
  mealType: ["Lunch", "Dinner", "Festival"],
  country: "Cameroon",
  regions: ["Littoral"],
  
  servingSizes: {
    small: "150g",
    medium: "300g",
    large: "450g"
  },
  
  nutrition: {
    calories: 420,
    protein: 28,
    carbohydrates: 15,
    fat: 30,
    fiber: 8,
    sugar: 2,
    sodium: 450,
  },
  
  scores: {
    healthScore: 8,
    satietyScore: 9,
    confidenceLevel: "Medium-High"
  },
  
  goalCompatibility: {
    weightLoss: { level: "Moderate", reason: "It is filling and low-carb, but calorie-dense. Portion control is essential." },
    weightGain: { level: "Excellent", reason: "Nutrient-dense and calorie-dense." },
    muscleBuilding: { level: "Excellent", reason: "High protein from meat, fish, and peanuts." },
    weightMaintenance: { level: "Good", reason: "Rich in vegetables and nuts, but oil and sodium must be monitored." },
    healthyEating: { level: "Good", reason: "Rich in vegetables and nuts, but oil and sodium must be monitored." },
    diabetesFriendly: { level: "Excellent", reason: "Low glycemic index; does not spike blood sugar." },
    heartHealthy: { level: "Moderate", reason: "Peanuts provide heart-healthy unsaturated fats, though this is offset if excessive palm oil is used." }
  },
  
  foodIntelligence: {
    bestFor: ["Satiety", "Digestion", "Heart Health"],
    goodSourceOf: ["Vitamin A", "Iron", "Healthy Fats"],
    concerns: ["High Calorie Density", "Sodium", "Saturated Fat"],
    healthierPreparation: ["Use less oil", "Reduce bouillon cubes"],
    recommendedFrequency: "2-3 times/week",
  },
  
  foodRelationships: {
    similarFoods: ["Eru", "Waterleaf Soup"],
    betterAlternatives: ["Ndolé prepared with less oil"],
    suggestedPairings: ["Boiled unripe plantains", "Boiled yams"],
    foodsToLimitTogether: ["Fried Plantains", "Bobolo", "Miondo"],
    sameCategory: ["Soups", "Traditional Dishes"],
    recommendedSideDishes: ["Boiled unripe plantains", "Boiled yams"]
  },

  preparationIntelligence: {
    boiled: {
      nutritionImpact: "Retains most nutrients",
      calorieImpact: "Low",
      healthImpact: "Positive",
      recommendationScore: 9
    }
  },
  
  mealIntelligence: {
    breakfast: false,
    lunch: true,
    dinner: true,
    snack: false,
    streetFood: false,
    festival: true
  },
  
  portionIntelligence: [
    { 
      recommendedPortion: "300g",
      commonMistake: "Eating a large bowl of Ndolé with multiple sticks of Bobolo",
      coachingMessage: "The calories from the oil + peanuts + dense carbs (Bobolo) can easily exceed 1000 kcal in a single sitting.",
      calorieImpact: "High"
    }
  ],
  
  aiCoaching: [
    { 
      title: "Portion Control", 
      message: "Ndolé is highly nutritious but calorie-dense; scoop less oil when serving to save calories.", 
      reason: "Oil increases calories.",
      priority: "High",
      goal: "Weight Loss",
      trigger: "Logging Ndolé with high calories"
    },
    { 
      title: "Stable Blood Sugar", 
      message: "Pairing Ndolé with boiled unripe plantain keeps your blood sugar stable for longer.", 
      reason: "Unripe plantains have a lower GI.",
      priority: "Medium",
      goal: "Healthy Eating",
      trigger: "Logging Ndolé with Bobolo"
    },
    { 
      title: "Muscle Recovery", 
      message: "The peanuts and meat in Ndolé provide excellent protein for muscle recovery.", 
      reason: "High protein.",
      priority: "Medium",
      goal: "Muscle Building",
      trigger: "Logging Ndolé after a workout"
    }
  ],
  
  cameraRecognition: {
    rawAppearance: ["Green leafy paste with peanuts", "Dark green mixture"],
    cookedAppearance: ["Thick dark green stew with oil and meat"],
    color: ["Dark Green", "Brown"],
    texture: ["Thick", "Paste-like"],
    shape: ["Irregular"],
    servingStyle: ["In a bowl", "Next to plantains or bobolo"],
    restaurantAppearance: ["Neatly plated with visible crayfish and beef"],
    streetFoodAppearance: ["Served in a plastic bowl or wrap"],
    commonGarnishes: ["Crayfish", "Shrimp", "Onions"],
    commonlyConfusedFoods: ["Eru", "Cassava Leaf Soup"],
    confidence: "High"
  },

  metadata: {
    researchVersion: "1.0",
    lastUpdated: new Date().toISOString().split('T')[0],
    dataCompleteness: 90,
    estimatedFields: ["sodium", "calories"],
    primarySources: ["Cameroon Food Composition Table", "Local Culinary Research"]
  }
};
