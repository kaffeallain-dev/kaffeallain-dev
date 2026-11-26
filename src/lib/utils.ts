import { format } from 'date-fns';
import { ConsumptionRecord, CustomFoodTemplate, UserSettings } from '../types';

export interface BackupData {
  version: 1;
  exportedAt: string;
  settings?: UserSettings;
  consumptions: ConsumptionRecord[];
  customFoods?: CustomFoodTemplate[];
}

export const exportCompleteJSONBackup = (
  settings: UserSettings,
  records: ConsumptionRecord[],
  customFoods: CustomFoodTemplate[]
) => {
  const data: BackupData = {
    version: 1,
    exportedAt: new Date().toISOString(),
    settings,
    consumptions: records,
    customFoods
  };

  const jsonStr = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.setAttribute('href', url);
  a.setAttribute('download', `mboafit_complete_backup_${format(new Date(), 'yyyy-MM-dd')}.json`);
  a.style.visibility = 'hidden';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const validateAndParseJSONBackup = (jsonStr: string): BackupData => {
  let parsed: any;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new Error('Invalid JSON file format.');
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Backup file must contain a root JSON object.');
  }

  // Support both full BackupData and bare array of consumptions
  const consumptionsList: any[] = Array.isArray(parsed) 
    ? parsed 
    : (Array.isArray(parsed.consumptions) ? parsed.consumptions : null);

  if (!consumptionsList) {
    throw new Error('Backup does not contain a valid consumptions list.');
  }

  const validatedConsumptions: ConsumptionRecord[] = [];
  const seenIds = new Set<string>();

  for (let i = 0; i < consumptionsList.length; i++) {
    const item = consumptionsList[i];
    if (!item || typeof item !== 'object') {
      throw new Error(`Record at index ${i} is not a valid object.`);
    }

    if (typeof item.id !== 'string' || !item.id.trim()) {
      throw new Error(`Record at index ${i} is missing a valid 'id'.`);
    }

    if (seenIds.has(item.id)) {
      // Skip exact duplicate IDs in file to ensure idempotency
      continue;
    }
    seenIds.add(item.id);

    if (typeof item.name !== 'string' || !item.name.trim()) {
      throw new Error(`Record at index ${i} is missing a food name.`);
    }

    const cals = Number(item.calories);
    if (!Number.isFinite(cals) || cals < 0) {
      throw new Error(`Record at index ${i} ("${item.name}") has invalid calories: ${item.calories}`);
    }

    const prot = Number(item.protein ?? 0);
    const carbs = Number(item.carbs ?? 0);
    const fat = Number(item.fat ?? 0);
    const servings = Number(item.servings ?? 1);
    const timestamp = Number(item.timestamp);

    if (!Number.isFinite(timestamp) || timestamp <= 0) {
      throw new Error(`Record at index ${i} ("${item.name}") has invalid timestamp.`);
    }

    validatedConsumptions.push({
      id: String(item.id).trim(),
      name: String(item.name).trim(),
      calories: Math.round(cals),
      protein: Number.isFinite(prot) && prot >= 0 ? Math.round(prot * 10) / 10 : 0,
      carbs: Number.isFinite(carbs) && carbs >= 0 ? Math.round(carbs * 10) / 10 : 0,
      fat: Number.isFinite(fat) && fat >= 0 ? Math.round(fat * 10) / 10 : 0,
      servings: Number.isFinite(servings) && servings > 0 ? servings : 1,
      mealCategory: (['Breakfast', 'Lunch', 'Dinner', 'Snacks'].includes(item.mealCategory) ? item.mealCategory : 'Snacks') as any,
      timestamp,
      foodId: typeof item.foodId === 'string' ? item.foodId : undefined,
      servingSizeText: typeof item.servingSizeText === 'string' ? item.servingSizeText : undefined
    });
  }

  return {
    version: 1,
    exportedAt: parsed.exportedAt || new Date().toISOString(),
    settings: parsed.settings && typeof parsed.settings === 'object' ? parsed.settings : undefined,
    consumptions: validatedConsumptions,
    customFoods: Array.isArray(parsed.customFoods) ? parsed.customFoods : []
  };
};

export const exportToCSV = (records: ConsumptionRecord[]) => {
  const headers = [
    'RecordID',
    'Date',
    'Time',
    'MealCategory',
    'FoodName',
    'Servings',
    'ServingBasis',
    'Calories',
    'ProteinG',
    'CarbsG',
    'FatG',
    'FoodID'
  ];
  
  const rows = records.map(record => {
    const d = new Date(record.timestamp);
    return [
      `"${record.id}"`,
      format(d, 'yyyy-MM-dd'),
      format(d, 'HH:mm'),
      `"${record.mealCategory}"`,
      `"${record.name.replace(/"/g, '""')}"`,
      record.servings,
      `"${(record.servingSizeText || '').replace(/"/g, '""')}"`,
      record.calories,
      record.protein,
      record.carbs,
      record.fat,
      `"${record.foodId || ''}"`
    ].join(',');
  });

  const csvContent = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.setAttribute('href', url);
  a.setAttribute('download', `mboafit_export_${format(new Date(), 'yyyy-MM-dd')}.csv`);
  a.style.visibility = 'hidden';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const parseCSV = async (file: File): Promise<ConsumptionRecord[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
        if (lines.length < 2) return resolve([]);
        
        const records: ConsumptionRecord[] = [];
        const seenIds = new Set<string>();

        for (let i = 1; i < lines.length; i++) {
          const l = lines[i];
          const matches = l.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
          if (!matches) continue;
          
          const row = matches.map(m => m.replace(/^"|"$/g, '').replace(/""/g, '"'));
          if (row.length >= 6) {
            let id = row[0];
            let dateStr = row[1];
            let timeStr = row[2];
            let mealCat = row[3];
            let name = row[4];
            let servings = Number(row[5]);
            let servingBasis = row[6] || '';
            let cals = Number(row[7]);
            let prot = Number(row[8] || 0);
            let carbs = Number(row[9] || 0);
            let fat = Number(row[10] || 0);
            let foodId = row[11] || undefined;

            // Handle legacy 6-column format: Date, Time, Meal, Food Name, Servings, Calories
            if (row.length === 6 && isNaN(Number(row[0]))) {
              dateStr = row[0];
              timeStr = row[1];
              mealCat = row[2];
              name = row[3];
              servings = Number(row[4]);
              cals = Number(row[5]);
              id = `imported_${dateStr}_${timeStr}_${name}_${i}`;
              servingBasis = '';
              prot = 0; carbs = 0; fat = 0;
            }

            if (!id || seenIds.has(id)) {
              id = id ? `${id}_${i}` : `csv_${Date.now()}_${i}`;
            }
            seenIds.add(id);

            const dt = new Date(`${dateStr}T${timeStr}`);
            const ts = isNaN(dt.getTime()) ? Date.now() : dt.getTime();

            records.push({
              id,
              timestamp: ts,
              mealCategory: (['Breakfast', 'Lunch', 'Dinner', 'Snacks'].includes(mealCat) ? mealCat : 'Snacks') as any,
              name: name || 'Logged Food',
              servings: Number.isFinite(servings) && servings > 0 ? servings : 1,
              servingSizeText: servingBasis || undefined,
              calories: Number.isFinite(cals) && cals >= 0 ? Math.round(cals) : 0,
              protein: Number.isFinite(prot) && prot >= 0 ? Math.round(prot * 10) / 10 : 0,
              carbs: Number.isFinite(carbs) && carbs >= 0 ? Math.round(carbs * 10) / 10 : 0,
              fat: Number.isFinite(fat) && fat >= 0 ? Math.round(fat * 10) / 10 : 0,
              foodId: foodId || undefined
            });
          }
        }
        resolve(records);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsText(file);
  });
};
