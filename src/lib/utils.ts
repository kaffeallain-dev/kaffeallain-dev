import { format } from 'date-fns';
import { ConsumptionRecord, MealCategory } from '../types';

export const exportToCSV = (records: ConsumptionRecord[]) => {
  const headers = ['Date', 'Time', 'Meal', 'Food Name', 'Servings', 'Total Calories'];

  const rows = records.map(record => {
    const d = new Date(record.timestamp);
    return [
      format(d, 'yyyy-MM-dd'),
      format(d, 'HH:mm'),
      record.mealCategory,
      `"${record.name.replace(/"/g, '""')}"`, // escape quotes
      record.servings,
      record.calories
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
  URL.revokeObjectURL(url); // don't leak the object URL
};

/** Split one CSV line into fields, honouring quoted sections and "" escapes. */
function splitCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++; // escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      fields.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields.map((f) => f.trim());
}

/**
 * Split text into logical CSV rows, merging physical lines when a quoted
 * field spans multiple lines.
 */
function splitCSVRows(text: string): string[] {
  const rows: string[] = [];
  let current = '';
  let inQuotes = false;

  const pushRow = () => {
    if (current.trim() !== '') rows.push(current);
    current = '';
  };

  for (const line of text.split('\n')) {
    current += (current ? '\n' : '') + line;
    for (const ch of line) {
      if (ch === '"') inQuotes = !inQuotes;
    }
    if (!inQuotes) pushRow();
  }
  pushRow();
  return rows;
}

const VALID_MEAL_CATEGORIES: MealCategory[] = ['Breakfast', 'Lunch', 'Dinner', 'Snacks'];

export const parseCSV = async (file: File): Promise<Partial<ConsumptionRecord>[]> => {
  const text = await file.text();
  const rows = splitCSVRows(text);
  if (rows.length < 2) return []; // only header or empty

  const records: Partial<ConsumptionRecord>[] = [];
  for (let i = 1; i < rows.length; i++) {
    const cols = splitCSVLine(rows[i]);
    if (cols.length < 6) continue;

    const [dateStr, timeStr, mealStr, name, servingsStr, caloriesStr] = cols;
    const dt = new Date(`${dateStr}T${timeStr}`);
    const servings = Number(servingsStr);
    const calories = Number(caloriesStr);

    // Row validation: skip anything that doesn't look like a real record.
    if (!name) continue;
    if (Number.isNaN(dt.getTime())) continue;
    if (!Number.isFinite(servings) || servings <= 0) continue;
    if (!Number.isFinite(calories) || calories < 0) continue;

    const mealCategory: MealCategory = (VALID_MEAL_CATEGORIES as string[]).includes(mealStr)
      ? (mealStr as MealCategory)
      : 'Snacks';

    records.push({
      id: crypto.randomUUID(),
      timestamp: dt.getTime(),
      mealCategory,
      name,
      servings,
      calories,
    });
  }
  return records;
};
