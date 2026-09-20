const fs = require('fs');
let code = fs.readFileSync('src/views/AnalyticsView.tsx', 'utf8');

const oldLine = `<ReferenceLine y={settings.dailyGoal} stroke="#10b981" strokeDasharray="4 4" label={{ position: 'top', value: 'Goal', fill: '#10b981', fontSize: 10, fontWeight: 600 }} />`;
const newLine = `<ReferenceLine y={settings.dailyGoal} stroke="#10b981" strokeDasharray="4 4" label={{ position: 'top', value: 'Target', fill: '#10b981', fontSize: 10, fontWeight: 600 }} />`;

if (code.includes(oldLine)) {
    code = code.replace(oldLine, newLine);
    fs.writeFileSync('src/views/AnalyticsView.tsx', code);
    console.log("Patched label successfully.");
} else {
    console.log("Could not find the exact line.");
}
