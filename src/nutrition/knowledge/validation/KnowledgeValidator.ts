import { FoodKnowledge } from '../types/FoodKnowledge';
import { ValidationReport } from './types';

export class KnowledgeValidator {
  
  public static validate(food: FoodKnowledge, existingAliases: Set<string>): { report: ValidationReport, updatedFood: FoodKnowledge } {
    const report: ValidationReport = {
      foodId: food.id || 'unknown',
      status: 'PASS',
      errors: [],
      warnings: [],
      completeness: 0
    };

    let totalFields = 0;
    let filledFields = 0;

    const checkField = (condition: boolean, errorMsg?: string, warningMsg?: string) => {
      totalFields++;
      if (condition) {
        filledFields++;
      } else {
        if (errorMsg) {
          report.errors.push(errorMsg);
          report.status = 'FAIL';
        }
        if (warningMsg && report.status !== 'FAIL') {
          report.warnings.push(warningMsg);
          report.status = 'WARNING';
        }
      }
    };

    // Identity
    checkField(!!food.id, 'Missing ID');
    checkField(!!food.name, 'Missing name');
    checkField(Array.isArray(food.aliases) && food.aliases.length > 0, 'Missing aliases');
    checkField(Array.isArray(food.searchKeywords) && food.searchKeywords.length > 0, 'Missing search keywords');
    
    // Duplicate Aliases inside the food itself
    if (food.aliases) {
      const uniqueAliases = new Set(food.aliases.map(a => a.toLowerCase().trim()));
      if (uniqueAliases.size !== food.aliases.length) {
        report.warnings.push('Duplicate aliases found within the food object');
      }
      
      // Check against existing aliases in the DB
      for (const alias of uniqueAliases) {
        if (existingAliases.has(alias)) {
           report.errors.push(`Alias or name "${alias}" already exists in the knowledge base`);
           report.status = 'FAIL';
        }
      }
    }

    if (food.scientificName) {
      // just check it's a string, can be improved
      checkField(typeof food.scientificName === 'string', undefined, 'Scientific name is not a string');
    }

    // Classification
    checkField(!!food.category, 'Missing category');
    checkField(Array.isArray(food.mealType) && food.mealType.length > 0, 'Missing meal type');
    checkField(!!food.country, 'Missing country');
    checkField(Array.isArray(food.regions) && food.regions.length > 0, 'Missing regions');

    // Serving Sizes
    checkField(!!food.servingSizes, 'Missing serving sizes object');
    if (food.servingSizes) {
      checkField(!!food.servingSizes.medium, 'Missing medium serving size');
      checkField(!!food.servingSizes.small, undefined, 'Missing small serving size');
      checkField(!!food.servingSizes.large, undefined, 'Missing large serving size');
      
      const checkMeasurement = (val?: string) => val && (val.includes('g') || val.includes('ml'));
      if (food.servingSizes.medium && !checkMeasurement(food.servingSizes.medium)) {
        report.warnings.push('Medium serving size should include grams or ml');
      }
    }

    // Nutrition
    checkField(!!food.nutrition, 'Missing nutrition object');
    if (food.nutrition) {
      checkField(typeof food.nutrition.calories === 'number', 'Missing calories');
      checkField(typeof food.nutrition.protein === 'number', 'Missing protein');
      checkField(typeof food.nutrition.carbohydrates === 'number', 'Missing carbohydrates');
      checkField(typeof food.nutrition.fat === 'number', 'Missing fat');
      checkField(typeof food.nutrition.fiber === 'number', 'Missing fiber');
      checkField(typeof food.nutrition.sodium === 'number', 'Missing sodium');
      
      checkField(typeof food.nutrition.sugar === 'number', undefined, 'Missing sugar');
      
      // Unrealistic values
      if (food.nutrition.calories < 0) report.errors.push('Negative calories');
      if (food.nutrition.protein < 0) report.errors.push('Negative protein');
      if (food.nutrition.fat < 0) report.errors.push('Negative fat');
      if (food.nutrition.carbohydrates < 0) report.errors.push('Negative carbohydrates');
      
      if (food.nutrition.protein > 1000) report.warnings.push('Unrealistic protein value');
    }

    // Scores
    checkField(!!food.scores, 'Missing scores object');
    if (food.scores) {
      checkField(typeof food.scores.healthScore === 'number' && food.scores.healthScore >= 1 && food.scores.healthScore <= 10, 'Health score must be between 1 and 10');
      checkField(typeof food.scores.satietyScore === 'number' && food.scores.satietyScore >= 1 && food.scores.satietyScore <= 10, 'Satiety score must be between 1 and 10');
      checkField(['Low', 'Medium', 'Medium-High', 'High'].includes(food.scores.confidenceLevel), 'Invalid confidence level');
    }

    // Goal Compatibility
    checkField(!!food.goalCompatibility, 'Missing goal compatibility object');
    if (food.goalCompatibility) {
      const goals = ['weightLoss', 'weightGain', 'muscleBuilding', 'weightMaintenance', 'healthyEating', 'diabetesFriendly', 'heartHealthy'] as const;
      for (const goal of goals) {
        checkField(!!food.goalCompatibility[goal], `Missing goal compatibility: ${goal}`);
        if (food.goalCompatibility[goal]) {
          checkField(['Excellent', 'Good', 'Moderate', 'Poor'].includes(food.goalCompatibility[goal].level), `Invalid level for goal ${goal}`);
          checkField(!!food.goalCompatibility[goal].reason, `Missing reason for goal ${goal}`);
        }
      }
    }

    // Food Intelligence
    checkField(!!food.foodIntelligence, 'Missing food intelligence object');
    if (food.foodIntelligence) {
      checkField(Array.isArray(food.foodIntelligence.bestFor) && food.foodIntelligence.bestFor.length > 0, 'Missing bestFor in food intelligence');
      checkField(Array.isArray(food.foodIntelligence.goodSourceOf), undefined, 'Missing goodSourceOf');
      checkField(Array.isArray(food.foodIntelligence.concerns), undefined, 'Missing concerns');
      checkField(!!food.foodIntelligence.recommendedFrequency, 'Missing recommendedFrequency');
    }

    // Food Relationships
    checkField(!!food.foodRelationships, 'Missing food relationships object');
    if (food.foodRelationships) {
      checkField(Array.isArray(food.foodRelationships.similarFoods), undefined, 'Missing similarFoods');
      checkField(Array.isArray(food.foodRelationships.betterAlternatives), undefined, 'Missing betterAlternatives');
      checkField(Array.isArray(food.foodRelationships.suggestedPairings), undefined, 'Missing suggestedPairings');
      checkField(Array.isArray(food.foodRelationships.foodsToLimitTogether), undefined, 'Missing foodsToLimitTogether');
      checkField(Array.isArray(food.foodRelationships.sameCategory), undefined, 'Missing sameCategory');
      checkField(Array.isArray(food.foodRelationships.recommendedSideDishes), undefined, 'Missing recommendedSideDishes');
    }

    // Preparation
    checkField(!!food.preparationIntelligence, 'Missing preparation intelligence object');
    if (food.preparationIntelligence) {
      const methods = Object.keys(food.preparationIntelligence) as (keyof typeof food.preparationIntelligence)[];
      for (const method of methods) {
        if (!food.preparationIntelligence[method]) {
          report.warnings.push(`Empty preparation method: ${method}`);
        }
      }
    }

    // AI Coaching
    checkField(Array.isArray(food.aiCoaching), 'Missing AI coaching array');
    if (Array.isArray(food.aiCoaching)) {
      const titles = new Set();
      for (const tip of food.aiCoaching) {
        checkField(!!tip.title && !!tip.message && !!tip.reason, 'Incomplete AI coaching tip');
        checkField(!!tip.priority && !!tip.goal && !!tip.trigger, 'Incomplete AI coaching context (priority, goal, trigger)');
        if (titles.has(tip.title)) {
          report.warnings.push(`Duplicate AI coaching title: ${tip.title}`);
        }
        titles.add(tip.title);
      }
    }

    // Camera Recognition
    checkField(!!food.cameraRecognition, 'Missing camera recognition intelligence');

    // Metadata & Data Completeness
    report.completeness = Math.round((filledFields / totalFields) * 100);
    
    const updatedFood = { ...food };
    if (!updatedFood.metadata) {
       updatedFood.metadata = {
         researchVersion: '1.0',
         lastUpdated: new Date().toISOString().split('T')[0],
         dataCompleteness: report.completeness,
         estimatedFields: [],
         primarySources: [],
         validationStatus: report.status,
         revisionHistory: []
       };
    } else {
       updatedFood.metadata = {
         ...updatedFood.metadata,
         dataCompleteness: report.completeness,
         validationStatus: report.status,
       };
    }

    return { report, updatedFood };
  }
}
