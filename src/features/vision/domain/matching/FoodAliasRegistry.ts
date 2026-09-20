export type AliasType =
  | 'SPELLING_VARIANT'
  | 'DIACRITIC_VARIANT'
  | 'ENGLISH'
  | 'FRENCH'
  | 'PIDGIN'
  | 'REGIONAL'
  | 'TRANSLITERATION'
  | 'COMMON_MISSPELLING';

export interface FoodAlias {
  alias: string;
  normalizedAlias: string;
  canonicalFoodId: string;
  aliasType: AliasType;
  language?: string;
  region?: string;
  confidence: 'HIGH' | 'MEDIUM';
}

export class FoodAliasRegistry {
  private static readonly registry: FoodAlias[] = [
    // Ndolé
    { alias: 'ndole', normalizedAlias: 'ndole', canonicalFoodId: 'sp1', aliasType: 'DIACRITIC_VARIANT', confidence: 'HIGH' },
    { alias: 'ndolè', normalizedAlias: 'ndole', canonicalFoodId: 'sp1', aliasType: 'DIACRITIC_VARIANT', confidence: 'HIGH' },
    { alias: 'ndolé', normalizedAlias: 'ndole', canonicalFoodId: 'sp1', aliasType: 'DIACRITIC_VARIANT', confidence: 'HIGH' },
    
    // Koki (Ambiguous handling: we point to both, so it triggers ambiguity)
    { alias: 'koki', normalizedAlias: 'koki', canonicalFoodId: 'td1', aliasType: 'COMMON_MISSPELLING', confidence: 'HIGH' },
    { alias: 'koki', normalizedAlias: 'koki', canonicalFoodId: 'td7', aliasType: 'COMMON_MISSPELLING', confidence: 'HIGH' },
    { alias: 'koki beans', normalizedAlias: 'koki beans', canonicalFoodId: 'td1', aliasType: 'ENGLISH', confidence: 'HIGH' },
    { alias: 'koki corn', normalizedAlias: 'koki corn', canonicalFoodId: 'td7', aliasType: 'ENGLISH', confidence: 'HIGH' },
    { alias: 'koki (bins)', normalizedAlias: 'koki bins', canonicalFoodId: 'td1', aliasType: 'PIDGIN', confidence: 'HIGH' },
    { alias: 'koki (kon)', normalizedAlias: 'koki kon', canonicalFoodId: 'td7', aliasType: 'PIDGIN', confidence: 'HIGH' },

    // Fufu / Couscous (Ambiguous)
    { alias: 'fufu', normalizedAlias: 'fufu', canonicalFoodId: 'st1', aliasType: 'REGIONAL', confidence: 'HIGH' },
    { alias: 'fufu', normalizedAlias: 'fufu', canonicalFoodId: 'st3', aliasType: 'REGIONAL', confidence: 'HIGH' },
    { alias: 'couscous', normalizedAlias: 'couscous', canonicalFoodId: 'st1', aliasType: 'FRENCH', confidence: 'HIGH' },
    { alias: 'couscous', normalizedAlias: 'couscous', canonicalFoodId: 'st3', aliasType: 'FRENCH', confidence: 'HIGH' },

    // Eru
    { alias: 'eru', normalizedAlias: 'eru', canonicalFoodId: 'sp2', aliasType: 'SPELLING_VARIANT', confidence: 'HIGH' },
    
    // Achu / Yellow Soup (Achu is ambiguous between pounded cocoyam and the combined meal)
    { alias: 'achu', normalizedAlias: 'achu', canonicalFoodId: 'st2', aliasType: 'REGIONAL', confidence: 'HIGH' },
    { alias: 'achu', normalizedAlias: 'achu', canonicalFoodId: 'td6', aliasType: 'REGIONAL', confidence: 'HIGH' },
    { alias: 'yellow soup', normalizedAlias: 'yellow soup', canonicalFoodId: 'td6', aliasType: 'ENGLISH', confidence: 'HIGH' },
    { alias: 'sauce jaune', normalizedAlias: 'sauce jaune', canonicalFoodId: 'td6', aliasType: 'FRENCH', confidence: 'HIGH' },

    // Bobolo / Miondo
    { alias: 'bobolo', normalizedAlias: 'bobolo', canonicalFoodId: 'st8', aliasType: 'REGIONAL', confidence: 'HIGH' },
    { alias: 'miondo', normalizedAlias: 'miondo', canonicalFoodId: 'st9', aliasType: 'REGIONAL', confidence: 'HIGH' },
    { alias: 'bâton de manioc', normalizedAlias: 'baton de manioc', canonicalFoodId: 'sn14', aliasType: 'FRENCH', confidence: 'HIGH' },

    // Plantain
    { alias: 'plantain', normalizedAlias: 'plantain', canonicalFoodId: 'st10', aliasType: 'ENGLISH', confidence: 'HIGH' },
    
    // Rice
    { alias: 'rice', normalizedAlias: 'rice', canonicalFoodId: 'st15', aliasType: 'ENGLISH', confidence: 'HIGH' },
    { alias: 'fried rice', normalizedAlias: 'fried rice', canonicalFoodId: 'cp4', aliasType: 'ENGLISH', confidence: 'HIGH' },
    
    // Fish
    // Note: 'fish' itself is too broad to map to a single canonical fish. It's ambiguous.
    { alias: 'roasted fish', normalizedAlias: 'roasted fish', canonicalFoodId: 'sf2', aliasType: 'ENGLISH', confidence: 'HIGH' },
    { alias: 'smoked fish', normalizedAlias: 'smoked fish', canonicalFoodId: 'pr7', aliasType: 'ENGLISH', confidence: 'HIGH' }
  ];

  public static normalize(name: string): string {
    if (!name) return "";
    return name
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // remove diacritics
      .toLowerCase()
      .replace(/-/g, ' ') // hyphen to space
      .replace(/[^a-z0-9\s]/g, '') // remove remaining punctuation
      .replace(/\s+/g, ' ') // collapse spaces
      .trim();
  }

  /**
   * Look up canonical IDs for an alias.
   * Returns an array of IDs. If length > 1, it's ambiguous.
   */
  public static resolveAlias(query: string): string[] {
    const normalizedQuery = this.normalize(query);
    const matches = this.registry.filter(a => a.normalizedAlias === normalizedQuery && a.canonicalFoodId !== '');
    
    // Return unique canonical IDs
    return Array.from(new Set(matches.map(m => m.canonicalFoodId)));
  }

  public static getAllAliases(): FoodAlias[] {
    return this.registry;
  }
}
