const fs = require('fs');
let code = fs.readFileSync('src/views/AnalyticsView.tsx', 'utf8');

const anchor = `  const lastUpdate = lastLog ? new Date(lastLog.timestamp) : new Date();`;
const injection = `  const lastUpdate = lastLog ? new Date(lastLog.timestamp) : new Date();

  // Calculate dynamic chart maximum to ensure target line is always visible
  const chartMax = Math.floor(Math.max(
    settings.dailyGoal,
    ...weeklyDataArr.map(d => d.calories || 0)
  ) * 1.15);`;

code = code.replace(anchor, injection);

const yAxisStr = `<YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#9ca3af', fontSize: 12, fontWeight: 500 }}
                />`;
const newYAxisStr = `<YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#9ca3af', fontSize: 12, fontWeight: 500 }}
                  domain={[0, chartMax]}
                />`;

code = code.replace(yAxisStr, newYAxisStr);

fs.writeFileSync('src/views/AnalyticsView.tsx', code);
console.log("Patched chart domain");
