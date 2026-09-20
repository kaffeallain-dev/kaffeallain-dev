const fs = require('fs');
let code = fs.readFileSync('src/views/AnalyticsView.tsx', 'utf8');

const oldLoop = `    const weeklyDataArr = [];
    for (let i = 6; i >= 0; i--) {
      const date = subDays(now, i);
      const start = startOfDay(date).getTime();
      const end = endOfDay(date).getTime();
      const dayConsumptions = allConsumptions.filter(c => c.timestamp >= start && c.timestamp <= end);
      const dayCals = Math.round(dayConsumptions.reduce((acc, c) => acc + c.calories, 0));
      weeklyDataArr.push({
        name: format(date, 'EEE'),
        calories: dayCals,
        date: format(date, 'MM/dd')
      });
    }`;

const newLoop = `    const weeklyDataArr = [];
    for (let i = 6; i >= 0; i--) {
      const date = subDays(now, i);
      const start = startOfDay(date).getTime();
      const end = endOfDay(date).getTime();
      const dayConsumptions = allConsumptions.filter(c => c.timestamp >= start && c.timestamp <= end);
      const hasData = dayConsumptions.length > 0;
      const dayCals = Math.round(dayConsumptions.reduce((acc, c) => acc + c.calories, 0));
      weeklyDataArr.push({
        name: format(date, 'EEE'),
        calories: hasData ? dayCals : null, // Important: null for missing days
        hasData,
        date: format(date, 'MM/dd')
      });
    }`;

code = code.replace(oldLoop, newLoop);

const oldDaysWithData = `const daysWithData = weeklyDataArr.filter(d => d.calories > 0).length;`;
const newDaysWithData = `const daysWithData = weeklyDataArr.filter(d => d.hasData).length;`;
code = code.replace(oldDaysWithData, newDaysWithData);

fs.writeFileSync('src/views/AnalyticsView.tsx', code);
console.log("Patched useMemo");
