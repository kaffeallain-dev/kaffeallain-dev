import { FoodKnowledge } from '../types/FoodKnowledge';

export const puffPuff: FoodKnowledge = {
  id: "puffPuff",
  name: "Puff Puff",
  aliases: ["Beignets", "Fried Dough", "Makate"],
  searchKeywords: ["puff puff", "beignets", "fried dough", "makate", "cameroon snack", "street food", "sweet dough"],
  category: "Street Foods",
  mealType: ["Breakfast", "Snack"],
  country: "Cameroon",
  regions: ["National"],
  
  servingSizes: {
    small: "3 pieces (approx. 90g)",
    medium: "5 pieces (approx. 150g)",
    large: "8+ pieces (approx. 240g+)"
  },
  
  nutrition: {
    calories: 450,
    protein: 8,
    carbohydrates: 65,
    fat: 18,
    fiber: 2,
    sugar: 15,
    sodium: 150,
  },
  
  scores: {
    healthScore: 2,
    satietyScore: 3,
    confidenceLevel: "High"
  },
  
  goalCompatibility: {
    weightLoss: { level: "Poor", reason: "High in calories, low in satiety." },
    weightGain: { level: "Good", reason: "High in pure calories." },
    muscleBuilding: { level: "Poor", reason: "Lacks adequate protein." },
    weightMaintenance: { level: "Poor", reason: "Low satiety makes it easy to overeat." },
    healthyEating: { level: "Poor", reason: "Refined carbs, sugar, and deep-frying oil offer very little nutritional value." },
    diabetesFriendly: { level: "Poor", reason: "Spikes blood sugar rapidly." },
    heartHealthy: { level: "Poor", reason: "Often fried in reused vegetable oils, containing trans fats or oxidized fats." }
  },
  
  foodIntelligence: {
    bestFor: ["Energy"],
    goodSourceOf: ["B-vitamins"],
    concerns: ["High Calorie Density", "Deep Fried Oils", "High Glycemic Index", "Low Satiety"],
    healthierPreparation: [],
    recommendedFrequency: "Rarely / Occasional",
  },
  
  foodRelationships: {
    similarFoods: ["Mandazi", "Bofrot", "Donuts"],
    betterAlternatives: ["Roasted plantain", "Boiled groundnuts", "Fresh fruit"],
    suggestedPairings: ["Beans (Haricot)", "Pap (Akamu)"],
    foodsToLimitTogether: ["Sugary drinks", "Folere with heavy sugar"],
    sameCategory: ["Street Foods", "Snacks"],
    recommendedSideDishes: ["Beans (Haricot)"]
  },

  preparationIntelligence: {
    fried: {
      nutritionImpact: "Absorbs large amounts of oil, increasing fat content significantly",
      calorieImpact: "Very High",
      healthImpact: "Negative",
      recommendationScore: 2
    }
  },
  
  mealIntelligence: {
    breakfast: true,
    lunch: false,
    dinner: false,
    snack: true,
    streetFood: true,
    festival: false
  },
  
  portionIntelligence: [
    { 
      recommendedPortion: "3 pieces",
      commonMistake: "Buying a large bag and eating it mindlessly",
      coachingMessage: "Puff Puff is very easy to overeat. Stick to 3 pieces to satisfy the craving without excess calories.",
      calorieImpact: "High"
    }
  ],
  
  aiCoaching: [
    { 
      title: "Pairing for Satiety", 
      message: "Puff Puff gives quick energy but leaves you hungry later. Pair it with beans to stay full!", 
      reason: "Beans add protein and fiber.",
      priority: "Medium",
      goal: "Healthy Eating",
      trigger: "Logging Puff Puff for breakfast"
    },
    { 
      title: "Heart Health", 
      message: "Beignets are deep-fried; enjoying them occasionally rather than daily supports heart health.", 
      reason: "Deep fried oils.",
      priority: "Medium",
      goal: "Heart Healthy",
      trigger: "Logging Puff Puff frequently"
    }
  ],
  
  cameraRecognition: {
    rawAppearance: ["Sticky white batter"],
    cookedAppearance: ["Golden brown, round fried dough balls"],
    color: ["Golden Brown"],
    texture: ["Soft", "Chewy", "Spongy", "Oily"],
    shape: ["Round", "Spherical"],
    servingStyle: ["In a paper bag", "On a plate"],
    restaurantAppearance: ["Neatly stacked, sometimes dusted with sugar"],
    streetFoodAppearance: ["Served in paper bags or newspaper"],
    commonGarnishes: ["None", "Sugar (rarely)"],
    commonlyConfusedFoods: ["Donuts", "Hushpuppies"],
    confidence: "High"
  },

  metadata: {
    researchVersion: "1.0",
    lastUpdated: new Date().toISOString().split('T')[0],
    dataCompleteness: 95,
    estimatedFields: [],
    primarySources: ["Global Food Composition Table"]
  }
};
