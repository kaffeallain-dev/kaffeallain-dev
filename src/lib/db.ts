import { openDB, DBSchema } from 'idb';
import { ConsumptionRecord, CustomFoodTemplate, UserSettings } from '../types';

interface CalorieTrackerDB extends DBSchema {
  consumptions: {
    key: string;
    value: ConsumptionRecord;
    indexes: { 'by-timestamp': number };
  };
  customFoods: {
    key: string;
    value: CustomFoodTemplate;
  };
  settings: {
    key: string;
    value: UserSettings;
  };
}

const DB_NAME = 'calorie-tracker-db';
const DB_VERSION = 1;

export const getDB = async () => {
  return openDB<CalorieTrackerDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('consumptions')) {
        const store = db.createObjectStore('consumptions', { keyPath: 'id' });
        store.createIndex('by-timestamp', 'timestamp');
      }
      if (!db.objectStoreNames.contains('customFoods')) {
        db.createObjectStore('customFoods', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'id' });
      }
    },
  });
};

// Settings
export const getSettings = async (): Promise<UserSettings> => {
  const db = await getDB();
  const settings = await db.get('settings', 'user');
  if (settings) return settings;
  const defaultSettings: UserSettings = { id: 'user', dailyGoal: 2000 };
  await db.put('settings', defaultSettings);
  return defaultSettings;
};

export const updateSettings = async (settings: UserSettings) => {
  const db = await getDB();
  await db.put('settings', settings);
};

// Consumptions
export const getConsumptionsInRange = async (start: number, end: number) => {
  const db = await getDB();
  const index = db.transaction('consumptions').store.index('by-timestamp');
  const range = IDBKeyRange.bound(start, end);
  return index.getAll(range);
};

export const getAllConsumptions = async () => {
  const db = await getDB();
  return db.getAll('consumptions');
};

export const addConsumption = async (record: ConsumptionRecord) => {
  const db = await getDB();
  await db.put('consumptions', record);
};

export const updateConsumption = async (record: ConsumptionRecord) => {
  const db = await getDB();
  await db.put('consumptions', record);
};

export const deleteConsumption = async (id: string) => {
  const db = await getDB();
  await db.delete('consumptions', id);
};

export const clearAllConsumptions = async () => {
  const db = await getDB();
  await db.clear('consumptions');
};

// Custom Foods
export const getCustomFoods = async () => {
  const db = await getDB();
  return db.getAll('customFoods');
};

export const addCustomFood = async (food: CustomFoodTemplate) => {
  const db = await getDB();
  await db.put('customFoods', food);
};

export const deleteCustomFood = async (id: string) => {
  const db = await getDB();
  await db.delete('customFoods', id);
};
