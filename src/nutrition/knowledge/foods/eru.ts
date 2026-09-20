import { FoodKnowledge } from '../types/FoodKnowledge';

export const eru: FoodKnowledge = {
  id: "eru",
  name: "Eru",
  aliases: ["Okazi"],
  searchKeywords: ["eru", "okazi", "waterleaf", "palm oil", "manyu", "cameroon soup"],
  scientificName: "Gnetum africanum, Talinum triangulare",
  category: "Soups",
  mealType: ["Lunch", "Dinner"],
  country: "Cameroon",
  regions: ["South West"],
  
  servingSizes: {
    medium: "250g"
  },
  
  nutrition: {
    calories: 450,
    protein: 25,
    carbohydrates: 10,
    fat: 35,
    fiber: 12,
    sugar: 1,
    sodium: 350,
  },
  
  scores: {
    healthScore: 7,
    satietyScore: 10,
    confidenceLevel: "Medium"
  },
  
  goalCompatibility: {
    weightLoss: { level: "Moderate", reason: "It is extremely filling (great for weight loss), but the oil must be strictly controlled." },
    weightGain: { level: "Good", reason: "High in fat." },
    muscleBuilding: { level: "Excellent", reason: "Dense in protein from assorted meats/fish." },
    weightMaintenance: { level: "Good", reason: "Extremely satiating." },
    healthyEating: { level: "Good", reason: "Nutritionally incredible, but heavily penalized for the massive amounts of palm oil typically used." },
    diabetesFriendly: { level: "Excellent", reason: "Very low carbs, high fiber." },
    heartHealthy: { level: "Moderate", reason: "Palm oil is high in saturated fat." }
  },
  
  foodIntelligence: {
    bestFor: ["Satiety", "Gut Health", "Nutrient Density"],
    goodSourceOf: ["Dietary Fiber", "Vitamin A", "Vitamin E", "Iron", "Calcium"],
    concerns: ["Extreme Fat Content", "Saturated Fat"],
    healthierPreparation: ["Use less palm oil"],
    recommendedFrequency: "1-2 times/week",
  },
  
  foodRelationships: {
    similarFoods: ["Afang Soup", "Waterleaf Soup"],
    betterAlternatives: ["Eru prepared with half the palm oil"],
    suggestedPairings: ["Water Fufu", "Garri"],
    foodsToLimitTogether: ["Large balls of Water Fufu"],
    sameCategory: ["Soups", "Traditional Dishes"],
    recommendedSideDishes: ["Small ball of Water Fufu", "Garri"]
  },

  preparationIntelligence: {
    boiled: {
      nutritionImpact: "Maintains fiber and minerals but requires cooking to break down tough leaves",
      calorieImpact: "Low",
      healthImpact: "Positive",
      recommendationScore: 8
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
      recommendedPortion: "250g",
      commonMistake: "Scooping up the excess oil pooling at the bottom of the plate",
      coachingMessage: "The oil pooling at the bottom of the plate contains hundreds of calories. Avoid scooping up the excess oil.",
      calorieImpact: "High"
    }
  ],
  
  aiCoaching: [
    { 
      title: "Satiety", 
      message: "Eru is packed with fiber and keeps you full for hours! Just watch the palm oil.", 
      reason: "High fiber, high fat.",
      priority: "Medium",
      goal: "Weight Loss",
      trigger: "Logging Eru"
    },
    { 
      title: "Calorie Reduction", 
      message: "Try leaving the excess oil on the plate instead of eating it to save a massive amount of calories.", 
      reason: "Oil contains empty calories.",
      priority: "High",
      goal: "Weight Loss",
      trigger: "Logging Eru with high calories"
    }
  ],
  
  cameraRecognition: {
    rawAppearance: ["Shredded dark green leaves"],
    cookedAppearance: ["Dark green and glossy mixture with visible meat/crayfish"],
    color: ["Dark Green", "Orange/Red from Palm Oil"],
    texture: ["Fibrous", "Oily"],
    shape: ["Irregular"],
    servingStyle: ["In a bowl alongside Water Fufu"],
    restaurantAppearance: ["Neatly portioned with large pieces of cow skin and beef"],
    streetFoodAppearance: ["Served generously in plastic plates"],
    commonGarnishes: ["Cow skin (kanda)", "Smoked fish"],
    commonlyConfusedFoods: ["Afang Soup", "Ndolé"],
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
