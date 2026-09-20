import { format } from 'date-fns';
import { ConsumptionRecord } from '../types';

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
  const link = document.createElement('url');
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.setAttribute('href', url);
  a.setAttribute('download', `mboafit_export_${format(new Date(), 'yyyy-MM-dd')}.csv`);
  a.style.visibility = 'hidden';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
};

export const parseCSV = async (file: File): Promise<Partial<ConsumptionRecord>[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split('\n').filter(l => l.trim() !== '');
        if (lines.length < 2) resolve([]); // only header or empty
        
        const records: Partial<ConsumptionRecord>[] = [];
        for (let i = 1; i < lines.length; i++) {
          const l = lines[i];
          // simple regex to handle quotes
          const matches = l.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
          if (!matches) continue;
          
          const row = matches.map(m => m.replace(/^"|"$/g, '').replace(/""/g, '"'));
          if (row.length >= 6) {
            const dateStr = row[0];
            const timeStr = row[1];
            const dt = new Date(`${dateStr}T${timeStr}`);
            
            records.push({
              id: crypto.randomUUID(),
              timestamp: dt.getTime(),
              mealCategory: row[2] as any,
              name: row[3],
              servings: Number(row[4]),
              calories: Number(row[5])
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
