export type TaxonomyCategory = 
  | 'STARCH'
  | 'PROTEIN'
  | 'SOUP'
  | 'STEW'
  | 'VEGETABLE'
  | 'FRUIT'
  | 'LEGUME'
  | 'DAIRY'
  | 'GRAIN'
  | 'SNACK'
  | 'BEVERAGE'
  | 'CONDIMENT'
  | 'OIL_FAT'
  | 'DESSERT'
  | 'MIXED_MEAL'
  | 'UNKNOWN';

export type TaxonomyFamily =
  | 'RICE' | 'PLANTAIN' | 'CASSAVA' | 'YAM' | 'POTATO' | 'PASTA' | 'BREAD' | 'FUFU' | 'CORN'
  | 'FISH' | 'CHICKEN' | 'BEEF' | 'GOAT' | 'PORK' | 'EGG' | 'LEGUME_PROTEIN' | 'OTHER_PROTEIN' | 'MEAT'
  | 'LEAFY_SOUP' | 'NUT_BASED_SOUP' | 'VEGETABLE_SOUP' | 'FISH_SOUP' | 'MEAT_SOUP' | 'OTHER_SOUP' | 'LIGHT_SOUP'
  | 'TOMATO_BASED' | 'VEGETABLE_BASED' | 'MEAT_BASED' | 'OTHER_STEW'
  | 'PASTRY' | 'NUT' | 'CANDY' | 'FRIED_SNACK' | 'DAIRY_SNACK'
  | 'JUICE' | 'SODA' | 'ALCOHOL' | 'HOT_BEVERAGE' | 'WATER' | 'ENERGY_DRINK'
  | 'SAUCE' | 'SPICE'
  | 'OTHER_FAMILY' | 'UNKNOWN_FAMILY';

export interface TaxonomyClassification {
  category: TaxonomyCategory;
  family?: TaxonomyFamily;
}

export type CompatibilityLevel = 'EXACT_COMPATIBLE' | 'FAMILY_COMPATIBLE' | 'CATEGORY_COMPATIBLE' | 'INCOMPATIBLE' | 'UNKNOWN';

import { FoodAliasRegistry } from '../matching/FoodAliasRegistry';

export class FoodTaxonomy {

  public static classifyFoodName(name: string, rawCategory?: string): TaxonomyClassification {
    const normalizedName = FoodAliasRegistry.normalize(name);
    const normalizedCat = rawCategory ? FoodAliasRegistry.normalize(rawCategory) : '';

    
    // First, try matching based on food name keywords.
    if (normalizedName.includes('rice')) return { category: 'STARCH', family: 'RICE' };
    if (normalizedName.includes('plantain')) return { category: 'STARCH', family: 'PLANTAIN' };
    // Explicitly Ambiguous Queries (Must evaluate to UNKNOWN to avoid blocking valid alias candidates)
    if (['koki', 'fufu', 'couscous', 'achu'].includes(normalizedName)) return { category: 'UNKNOWN' };

    if (normalizedName.includes('cassava') || normalizedName.includes('bobolo') || normalizedName.includes('miondo') || normalizedName.includes('garri') || normalizedName.includes('water fufu')) return { category: 'STARCH', family: 'CASSAVA' };
    if (normalizedName.includes('yam')) return { category: 'STARCH', family: 'YAM' };
    if (normalizedName.includes('potato') || normalizedName.includes('potatoes')) return { category: 'STARCH', family: 'POTATO' };
    if (normalizedName.includes('pasta') || normalizedName.includes('spaghetti') || normalizedName.includes('macaroni') || normalizedName.includes('indomie')) return { category: 'STARCH', family: 'PASTA' };
    if (normalizedName.includes('bread') || normalizedName.includes('baguette')) return { category: 'STARCH', family: 'BREAD' };
    if (normalizedName.includes('fufu') || normalizedName.includes('foufou')) return { category: 'STARCH', family: 'FUFU' };
    if (normalizedName.includes('corn') || normalizedName.includes('pap ') || normalizedName === 'pap' || normalizedName.includes('koki corn') || normalizedName.includes('koki kon')) return { category: 'STARCH', family: 'CORN' };
    
    if (normalizedName.includes('puff puff') || normalizedName.includes('chin chin') || normalizedName.includes('biscuit') || normalizedName.includes('pie') || normalizedName.includes('roll') || normalizedName.includes('caravelle')) return { category: 'SNACK', family: 'PASTRY' };
    
    if (normalizedName.includes('fish') || normalizedName.includes('sardine')) return { category: 'PROTEIN', family: 'FISH' };
    if (normalizedName.includes('chicken') || normalizedName.includes('poulet')) return { category: 'PROTEIN', family: 'CHICKEN' };
    if (normalizedName.includes('beef') || normalizedName.includes('suya') || normalizedName.includes('soya')) return { category: 'PROTEIN', family: 'BEEF' };
    if (normalizedName.includes('goat') || normalizedName.includes('kati kati')) return { category: 'PROTEIN', family: 'GOAT' };
    if (normalizedName.includes('pork')) return { category: 'PROTEIN', family: 'PORK' };
    if (normalizedName.includes('egg') || normalizedName.includes('omelette')) return { category: 'PROTEIN', family: 'EGG' };
    if (normalizedName.includes('meat') || normalizedName.includes('kilishi') || normalizedName.includes('kanda') || normalizedName.includes('snails') || normalizedName.includes('tripes') || normalizedName.includes('bongo meat')) return { category: 'PROTEIN', family: 'MEAT' };

    if (normalizedName.includes('ndole') || normalizedName.includes('eru') || normalizedName.includes('kwem') || normalizedName.includes('sangah') || normalizedName.includes('okrol') || normalizedName.includes('okro') || normalizedName.includes('waterleaf')) return { category: 'SOUP', family: 'LEAFY_SOUP' };
    if (normalizedName.includes('groundnut soup') || normalizedName.includes('egusi') || normalizedName.includes('ogbono')) return { category: 'SOUP', family: 'NUT_BASED_SOUP' };
    if (normalizedName.includes('achu') || normalizedName.includes('yellow soup') || normalizedName.includes('light soup')) return { category: 'SOUP', family: 'OTHER_SOUP' };
    if (normalizedName.includes('soup')) return { category: 'SOUP', family: 'OTHER_SOUP' };
    if (normalizedName.includes('stew') || normalizedName.includes('sauce') || normalizedName.includes('bongo tjobi')) return { category: 'STEW', family: 'TOMATO_BASED' };

    if (normalizedName.includes('bean') || normalizedName.includes('koki') || normalizedName.includes('ekwang') || normalizedName.includes('lentil') || normalizedName.includes('pea')) return { category: 'LEGUME', family: 'LEGUME_PROTEIN' };

    if (normalizedName.includes('groundnut') || normalizedName.includes('peanut') || normalizedName.includes('tiger nut') || normalizedName.includes('walnut') || normalizedName.includes('kuli kuli')) return { category: 'SNACK', family: 'NUT' };
    if (normalizedName.includes('cand') || normalizedName.includes('chocolate')) return { category: 'SNACK', family: 'CANDY' };
    if (normalizedName.includes('ice cream')) return { category: 'SNACK', family: 'DAIRY_SNACK' };
    if (normalizedName.includes('popcorn') || normalizedName.includes('chips')) return { category: 'SNACK', family: 'FRIED_SNACK' };

    if (normalizedName.includes('water') && !normalizedName.includes('watermelon') && !normalizedName.includes('fufu')) return { category: 'BEVERAGE', family: 'WATER' };
    if (normalizedName.includes('juice') || normalizedName.includes('folere') || normalizedName.includes('lemonade') || normalizedName.includes('ginger')) return { category: 'BEVERAGE', family: 'JUICE' };
    if (normalizedName.includes('soda') || normalizedName.includes('malt')) return { category: 'BEVERAGE', family: 'SODA' };
    if (normalizedName.includes('beer') || normalizedName.includes('wine')) return { category: 'BEVERAGE', family: 'ALCOHOL' };
    if (normalizedName.includes('coffee') || normalizedName.includes('tea')) return { category: 'BEVERAGE', family: 'HOT_BEVERAGE' };
    if (normalizedName.includes('energy drink')) return { category: 'BEVERAGE', family: 'ENERGY_DRINK' };
    
    if (normalizedName.includes('milk') || normalizedName.includes('cheese') || normalizedName.includes('kossam') || normalizedName.includes('yoghurt')) return { category: 'DAIRY' };
    
    if (normalizedName.includes('apple') || normalizedName.includes('banana') || normalizedName.includes('mango') || normalizedName.includes('pineapple') || normalizedName.includes('papaya') || normalizedName.includes('watermelon') || normalizedName.includes('avocado') || normalizedName.includes('orange') || normalizedName.includes('guava') || normalizedName.includes('plum')) return { category: 'FRUIT' };

    if (normalizedName.includes('salad') || normalizedName.includes('vegetable')) return { category: 'VEGETABLE' };

    if (normalizedName.includes('mayonnaise') || normalizedName.includes('ketchup') || normalizedName.includes('butter') || normalizedName.includes('margarine')) return { category: 'CONDIMENT' };
    
    if (normalizedName.includes('pizza') || normalizedName.includes('burger') || normalizedName.includes('shawarma')) return { category: 'MIXED_MEAL' };

    // Fallback to rawCategory parsing
    if (normalizedCat.includes('starch') || normalizedCat.includes('swallow')) return { category: 'STARCH' };
    if (normalizedCat.includes('protein') || normalizedCat.includes('meat') || normalizedCat.includes('fish')) return { category: 'PROTEIN' };
    if (normalizedCat.includes('soup')) return { category: 'SOUP' };
    if (normalizedCat.includes('stew')) return { category: 'STEW' };
    if (normalizedCat.includes('snack')) return { category: 'SNACK' };
    if (normalizedCat.includes('drink') || normalizedCat.includes('beverage')) return { category: 'BEVERAGE' };
    if (normalizedCat.includes('fruit')) return { category: 'FRUIT' };
    if (normalizedCat.includes('vegetable')) return { category: 'VEGETABLE' };
    
    return { category: 'UNKNOWN' };
  }

  public static classifyDatabaseFood(food: { name: string, category?: string }): TaxonomyClassification {
    // For database foods, we do the same name/category-based inference
    return this.classifyFoodName(food.name, food.category);
  }

  public static getCompatibilityLevel(
    queryClass: TaxonomyClassification,
    targetClass: TaxonomyClassification
  ): CompatibilityLevel {
    const { category: qCat, family: qFam } = queryClass;
    const { category: tCat, family: tFam } = targetClass;

    if (qCat === 'UNKNOWN' || tCat === 'UNKNOWN') {
      return 'UNKNOWN'; // If either is unknown, we can't definitively rule it out by taxonomy.
    }

    if (qCat === tCat) {
      if (qFam && tFam && qFam === tFam) {
        return 'EXACT_COMPATIBLE'; // Same Category AND Same Family
      }
      return 'CATEGORY_COMPATIBLE'; // Same Category, Different/Unknown Family
    }

    // Certain cross-category compatibilities
    if ((qCat === 'SOUP' && tCat === 'STEW') || (qCat === 'STEW' && tCat === 'SOUP')) {
      return 'CATEGORY_COMPATIBLE';
    }
    
    if ((qCat === 'STARCH' && tCat === 'MIXED_MEAL') || (qCat === 'MIXED_MEAL' && tCat === 'STARCH')) {
       return 'CATEGORY_COMPATIBLE';
    }

    if ((qCat === 'PROTEIN' && tCat === 'MIXED_MEAL') || (qCat === 'MIXED_MEAL' && tCat === 'PROTEIN')) {
       return 'CATEGORY_COMPATIBLE';
    }

    // Incompatible cases explicitly
    const drinks = ['BEVERAGE'];
    const nonDrinks = ['STARCH', 'PROTEIN', 'SOUP', 'STEW', 'VEGETABLE', 'LEGUME', 'GRAIN', 'MIXED_MEAL'];
    
    if (drinks.includes(qCat) && nonDrinks.includes(tCat)) return 'INCOMPATIBLE';
    if (nonDrinks.includes(qCat) && drinks.includes(tCat)) return 'INCOMPATIBLE';
    
    if (qCat === 'CONDIMENT' && nonDrinks.includes(tCat) && tCat !== 'MIXED_MEAL') return 'INCOMPATIBLE';
    if (nonDrinks.includes(qCat) && qCat !== 'MIXED_MEAL' && tCat === 'CONDIMENT') return 'INCOMPATIBLE';

    return 'INCOMPATIBLE';
  }

  public static isCompatible(
    queryClass: TaxonomyClassification,
    targetClass: TaxonomyClassification
  ): boolean {
    const level = this.getCompatibilityLevel(queryClass, targetClass);
    return level !== 'INCOMPATIBLE';
  }
}
