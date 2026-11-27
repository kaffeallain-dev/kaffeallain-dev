import { 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  deleteDoc, 
  collection, 
  writeBatch 
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import { ConsumptionRecord, CustomFoodTemplate, UserSettings } from '../types';

/**
 * Recursively strips undefined values so Firestore does not reject writes with
 * "Unsupported field value: undefined" error.
 */
export function sanitizeForFirestore<T>(data: T): T {
  if (data === null || data === undefined) {
    return data;
  }
  if (Array.isArray(data)) {
    return data.map(item => sanitizeForFirestore(item)) as unknown as T;
  }
  if (typeof data === 'object') {
    const cleaned: Record<string, any> = {};
    for (const [key, value] of Object.entries(data as Record<string, any>)) {
      if (value !== undefined) {
        cleaned[key] = sanitizeForFirestore(value);
      }
    }
    return cleaned as T;
  }
  return data;
}

export const firestoreService = {
  // --- User Profile & Settings ---
  async getUserSettings(userId: string): Promise<UserSettings | null> {
    const path = `users/${userId}`;
    try {
      const snap = await getDoc(doc(db, 'users', userId));
      if (!snap.exists()) return null;
      const data = snap.data();
      return {
        id: userId,
        dailyGoal: typeof data.dailyGoal === 'number' && data.dailyGoal >= 500 ? data.dailyGoal : 2000,
        profile: data.profile || undefined,
        onboardingCompleted: data.onboardingCompleted ?? Boolean(data.profile?.primaryGoal)
      };
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, path);
    }
  },

  async saveUserSettings(userId: string, settings: UserSettings): Promise<void> {
    const path = `users/${userId}`;
    try {
      const rawPayload: Record<string, any> = {
        userId,
        dailyGoal: typeof settings.dailyGoal === 'number' && settings.dailyGoal >= 500 ? settings.dailyGoal : 2000,
        onboardingCompleted: Boolean(settings.onboardingCompleted ?? settings.profile?.primaryGoal),
        updatedAt: new Date().toISOString()
      };
      if (settings.profile) {
        rawPayload.profile = settings.profile;
      }
      const sanitized = sanitizeForFirestore(rawPayload);
      await setDoc(doc(db, 'users', userId), sanitized, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  },

  // --- Meals / Consumptions ---
  async getUserConsumptions(userId: string): Promise<ConsumptionRecord[]> {
    const path = `users/${userId}/meals`;
    try {
      const snap = await getDocs(collection(db, 'users', userId, 'meals'));
      return snap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          name: data.name,
          calories: Number(data.calories) || 0,
          protein: Number(data.protein) || 0,
          carbs: Number(data.carbs) || 0,
          fat: Number(data.fat) || 0,
          servings: Number(data.servings) || 1,
          mealCategory: data.mealCategory || 'Snacks',
          timestamp: Number(data.timestamp) || Date.now(),
          foodId: data.foodId,
          servingSizeText: data.servingSizeText
        } as ConsumptionRecord;
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, path);
    }
  },

  async saveConsumption(userId: string, record: ConsumptionRecord): Promise<void> {
    const path = `users/${userId}/meals/${record.id}`;
    try {
      const rawPayload: Record<string, any> = {
        id: record.id,
        userId,
        name: (record.name || 'Meal').slice(0, 200),
        calories: Number(record.calories) || 0,
        protein: Number(record.protein) || 0,
        carbs: Number(record.carbs) || 0,
        fat: Number(record.fat) || 0,
        servings: Number(record.servings) || 1,
        mealCategory: record.mealCategory || 'Snacks',
        timestamp: Number(record.timestamp) || Date.now(),
        createdAt: Date.now()
      };
      if (record.foodId) rawPayload.foodId = record.foodId;
      if (record.servingSizeText) rawPayload.servingSizeText = record.servingSizeText.slice(0, 100);

      const sanitized = sanitizeForFirestore(rawPayload);
      await setDoc(doc(db, 'users', userId, 'meals', record.id), sanitized, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  },

  async deleteConsumption(userId: string, recordId: string): Promise<void> {
    const path = `users/${userId}/meals/${recordId}`;
    try {
      await deleteDoc(doc(db, 'users', userId, 'meals', recordId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  },

  // --- Custom Foods ---
  async getUserCustomFoods(userId: string): Promise<CustomFoodTemplate[]> {
    const path = `users/${userId}/customFoods`;
    try {
      const snap = await getDocs(collection(db, 'users', userId, 'customFoods'));
      return snap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          name: data.name,
          calories: Number(data.calories) || 0,
          protein: Number(data.protein) || 0,
          carbs: Number(data.carbs) || 0,
          fat: Number(data.fat) || 0,
          servingSizeText: data.servingSizeText,
          createdAt: Number(data.createdAt) || Date.now(),
          isCustom: true
        } as CustomFoodTemplate;
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, path);
    }
  },

  async saveCustomFood(userId: string, food: CustomFoodTemplate): Promise<void> {
    const path = `users/${userId}/customFoods/${food.id}`;
    try {
      const rawPayload: Record<string, any> = {
        id: food.id,
        userId,
        name: (food.name || 'Custom Food').slice(0, 200),
        calories: Number(food.calories) || 0,
        protein: Number(food.protein) || 0,
        carbs: Number(food.carbs) || 0,
        fat: Number(food.fat) || 0,
        servingSizeText: (food.servingSizeText || '1 serving').slice(0, 100),
        createdAt: Number(food.createdAt) || Date.now(),
        isCustom: true
      };
      const sanitized = sanitizeForFirestore(rawPayload);
      await setDoc(doc(db, 'users', userId, 'customFoods', food.id), sanitized, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  },

  async deleteCustomFood(userId: string, foodId: string): Promise<void> {
    const path = `users/${userId}/customFoods/${foodId}`;
    try {
      await deleteDoc(doc(db, 'users', userId, 'customFoods', foodId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  },

  // --- Explicit Idempotent Local -> Cloud Import with Deduplication & Cloud Settings Preservation ---
  async importLocalToCloud(
    userId: string, 
    localSettings: UserSettings, 
    localConsumptions: ConsumptionRecord[], 
    localCustomFoods: CustomFoodTemplate[],
    preserveCloudSettings: boolean = true
  ): Promise<{ importedMeals: number; importedCustomFoods: number }> {
    // 1. Fetch existing items to guarantee deduplication
    let existingMealIds = new Set<string>();
    let existingMealKeys = new Set<string>();
    let existingFoodIds = new Set<string>();
    let existingFoodNames = new Set<string>();
    try {
      const existingMeals = await this.getUserConsumptions(userId);
      existingMealIds = new Set(existingMeals.map(m => m.id));
      existingMealKeys = new Set(existingMeals.map(m => `${m.timestamp}_${m.name.trim().toLowerCase()}`));
      const existingFoods = await this.getUserCustomFoods(userId);
      existingFoodIds = new Set(existingFoods.map(f => f.id));
      existingFoodNames = new Set(existingFoods.map(f => f.name.trim().toLowerCase()));
    } catch (fetchErr) {
      console.warn('Could not fetch existing cloud items for deduplication, proceeding with ID check:', fetchErr);
    }

    // 2. Prepare operations
    const ops: Array<{ ref: any; data: any }> = [];

    // Cloud settings preservation check: NEVER overwrite cloud settings if they already exist
    let shouldWriteSettings = !preserveCloudSettings;
    if (preserveCloudSettings) {
      try {
        const cloudSettings = await this.getUserSettings(userId);
        if (!cloudSettings || (!cloudSettings.onboardingCompleted && !cloudSettings.profile?.primaryGoal)) {
          // Cloud has no existing custom settings, safe to apply imported settings
          shouldWriteSettings = true;
        }
      } catch {
        shouldWriteSettings = false;
      }
    }

    if (shouldWriteSettings) {
      const userRef = doc(db, 'users', userId);
      ops.push({
        ref: userRef,
        data: sanitizeForFirestore({
          userId,
          dailyGoal: localSettings.dailyGoal || 2000,
          profile: localSettings.profile || {},
          onboardingCompleted: Boolean(localSettings.onboardingCompleted ?? localSettings.profile?.primaryGoal),
          updatedAt: new Date().toISOString()
        })
      });
    }

    let importedMeals = 0;
    for (const record of localConsumptions) {
      const mealKey = `${record.timestamp}_${record.name.trim().toLowerCase()}`;
      if (existingMealIds.has(record.id) || existingMealKeys.has(mealKey)) {
        continue; // Deduplicate: already exists on cloud
      }
      const mealRef = doc(db, 'users', userId, 'meals', record.id);
      ops.push({
        ref: mealRef,
        data: sanitizeForFirestore({
          id: record.id,
          userId,
          name: (record.name || 'Meal').slice(0, 200),
          calories: Number(record.calories) || 0,
          protein: Number(record.protein) || 0,
          carbs: Number(record.carbs) || 0,
          fat: Number(record.fat) || 0,
          servings: Number(record.servings) || 1,
          mealCategory: record.mealCategory || 'Snacks',
          timestamp: Number(record.timestamp) || Date.now(),
          createdAt: Date.now(),
          ...(record.foodId ? { foodId: record.foodId } : {}),
          ...(record.servingSizeText ? { servingSizeText: record.servingSizeText.slice(0, 100) } : {})
        })
      });
      importedMeals++;
      existingMealIds.add(record.id);
    }

    let importedCustomFoods = 0;
    for (const food of localCustomFoods) {
      const foodName = food.name.trim().toLowerCase();
      if (existingFoodIds.has(food.id) || existingFoodNames.has(foodName)) {
        continue; // Deduplicate: already exists on cloud
      }
      const foodRef = doc(db, 'users', userId, 'customFoods', food.id);
      ops.push({
        ref: foodRef,
        data: sanitizeForFirestore({
          id: food.id,
          userId,
          name: (food.name || 'Custom Food').slice(0, 200),
          calories: Number(food.calories) || 0,
          protein: Number(food.protein) || 0,
          carbs: Number(food.carbs) || 0,
          fat: Number(food.fat) || 0,
          servingSizeText: (food.servingSizeText || '1 serving').slice(0, 100),
          createdAt: Number(food.createdAt) || Date.now(),
          isCustom: true
        })
      });
      importedCustomFoods++;
      existingFoodIds.add(food.id);
    }

    // Execute in chunks of <= 400 ops (Firestore max is 500 per batch) with retry
    const CHUNK_SIZE = 400;
    for (let i = 0; i < ops.length; i += CHUNK_SIZE) {
      const chunk = ops.slice(i, i + CHUNK_SIZE);
      let committed = false;
      let lastBatchErr: any = null;

      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const batch = writeBatch(db);
          for (const op of chunk) {
            batch.set(op.ref, op.data, { merge: true });
          }
          await batch.commit();
          committed = true;
          break;
        } catch (bErr) {
          lastBatchErr = bErr;
          console.warn(`Batch commit attempt ${attempt + 1} failed:`, bErr);
          await new Promise(r => setTimeout(r, 200));
        }
      }

      if (!committed) {
        throw lastBatchErr || new Error('Batch commit failed after retries');
      }
    }

    return { importedMeals, importedCustomFoods };
  }
};
