const fs = require('fs');
let code = fs.readFileSync('src/views/AnalyticsView.tsx', 'utf8');

const oldChart = `  const getChartInterpretation = () => {
    if (daysWithData === 0) {
      return "Log a few meals to see your 7-day calorie pattern.";
    }
    if (daysWithData < 3) {
      return "We only have a few logged days, so this week's calorie pattern is still taking shape.";
    }
    
    const dataPoints = weeklyDataArr.filter(d => d.hasData).map(d => d.calories);
    const max = Math.max(...dataPoints);
    const min = Math.min(...dataPoints);
    const avg = dataPoints.reduce((a, b) => a + b, 0) / dataPoints.length;
    
    const variation = (max - min) / avg;
    if (variation > 0.5) {
      return "Your logged intake has varied quite a bit this week.";
    } else {
      return "Your logged intake has stayed fairly consistent this week.";
    }
  };`;

const newChart = `  const getChartInterpretation = () => {
    if (daysWithData === 0) {
      return {
        interpretation: "Log a few meals to see your 7-day calorie pattern.",
        fact: null
      };
    }
    if (daysWithData < 3) {
      return {
        interpretation: "We only have a few logged days, so this week's calorie pattern is still taking shape.",
        fact: null
      };
    }
    
    const validDays = weeklyDataArr.filter(d => d.hasData);
    const dataPoints = validDays.map(d => d.calories);
    const max = Math.max(...dataPoints);
    const min = Math.min(...dataPoints);
    const avg = dataPoints.reduce((a, b) => a + b, 0) / dataPoints.length;
    
    let interpretation = "";
    const variation = (max - min) / avg;
    if (variation > 0.5) {
      interpretation = "Your logged intake has varied quite a bit this week.";
    } else {
      interpretation = "Your logged intake has stayed fairly consistent this week.";
    }
    
    // Calculate a specific fact
    let fact = null;
    const daysNearTarget = validDays.filter(d => Math.abs(d.calories - settings.dailyGoal) < 300).length;
    
    if (daysNearTarget >= 3) {
      fact = \`\${daysNearTarget} of \${daysWithData} logged days were close to your target.\`;
    } else {
      // Find highest day
      const highestDay = validDays.reduce((prev, current) => (prev.calories > current.calories) ? prev : current);
      fact = \`Highest logged day: \${highestDay.name} · \${highestDay.calories} kcal\`;
    }
    
    return { interpretation, fact };
  };`;

if(code.indexOf(oldChart) !== -1) {
    code = code.replace(oldChart, newChart);
    
    // Now we need to update the JSX where chartInterpretation is used
    const oldJsx = `<p className="text-sm font-medium text-gray-700 mb-4">{chartInterpretation}</p>`;
    const newJsx = `<div className="mb-4">
            <p className="text-sm font-bold text-gray-800">{chartInterpretation.interpretation}</p>
            {chartInterpretation.fact && (
              <p className="text-sm text-gray-500 mt-1">{chartInterpretation.fact}</p>
            )}
          </div>`;
          
    code = code.replace(oldJsx, newJsx);
    fs.writeFileSync('src/views/AnalyticsView.tsx', code);
    console.log("Patched getChartInterpretation");
} else {
    console.log("Could not find getChartInterpretation to patch.");
}
