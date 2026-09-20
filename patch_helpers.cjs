const fs = require('fs');
let code = fs.readFileSync('src/views/AnalyticsView.tsx', 'utf8');

const helpersToAdd = `
  const getWeeklyTrends = () => {
    if (daysWithData < 3) {
      return { hasEnoughData: false };
    }
    
    const trends = [];
    
    // Vegetables
    if (currentSummary.weeklyPattern.vegetableTrend === 'Needs Improvement') {
      trends.push({
        id: 'veg-bad',
        title: 'Vegetables',
        status: 'Needs attention',
        observation: 'Vegetables appeared less often than your usual pattern.',
        nextStep: 'Try adding a vegetable-rich side to one more meal this week.',
        priority: 1,
        colorClass: 'text-amber-700 bg-amber-50 border-amber-200'
      });
    } else {
      trends.push({
        id: 'veg-good',
        title: 'Vegetables',
        status: 'Looking good',
        observation: 'Vegetables have appeared consistently across your logged meals.',
        priority: 3,
        colorClass: 'text-emerald-700 bg-emerald-50 border-emerald-200'
      });
    }
    
    // Protein
    if (currentSummary.weeklyPattern.proteinTrend === 'Strong') {
      trends.push({
        id: 'protein-good',
        title: 'Protein',
        status: 'Looking good',
        observation: 'Protein has been consistent across your logged meals.',
        nextStep: 'Keep including strong protein sources to support satiety.',
        priority: 1,
        colorClass: 'text-emerald-700 bg-emerald-50 border-emerald-200'
      });
    } else {
      trends.push({
        id: 'protein-avg',
        title: 'Protein',
        status: 'Average',
        observation: 'Protein intake has been moderate across your logged meals.',
        priority: 4,
        colorClass: 'text-gray-700 bg-gray-50 border-gray-200'
      });
    }
    
    // Sugary Drinks
    if (currentSummary.weeklyPattern.sugaryDrinkTrend === 'High') {
      trends.push({
        id: 'sugar-high',
        title: 'Sugary Drinks',
        status: 'Needs attention',
        observation: 'Sugary drinks appeared frequently in your recent logs.',
        nextStep: 'Consider substituting water or a sugar-free alternative for one drink tomorrow.',
        priority: 2,
        colorClass: 'text-amber-700 bg-amber-50 border-amber-200'
      });
    }
    
    // Fried Foods
    if (currentSummary.weeklyPattern.friedFoodTrend === 'High') {
      trends.push({
        id: 'fried-high',
        title: 'Fried Foods',
        status: 'Needs attention',
        observation: 'Fried foods appeared frequently in your recent logs.',
        nextStep: 'If reducing fried foods is part of your goal, try a grilled or boiled option for one meal.',
        priority: 2,
        colorClass: 'text-amber-700 bg-amber-50 border-amber-200'
      });
    }
    
    trends.sort((a, b) => a.priority - b.priority);
    return {
      hasEnoughData: true,
      primary: trends[0],
      secondary: trends.slice(1, 4) // Show up to 3 secondary
    };
  };

  const getChartInterpretation = () => {
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
  };

  const weeklyTrends = getWeeklyTrends();
  const chartInterpretation = getChartInterpretation();
`;

code = code.replace(
  'const foodPattern = getFoodPattern();',
  'const foodPattern = getFoodPattern();\n' + helpersToAdd
);

// Now patch CustomTooltip
const tooltipRegex = /const CustomTooltip = \(\{\s*active,\s*payload\s*\}\s*:\s*any\) => \{[\s\S]*?return null;\s*\};/;
const newTooltip = `const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      if (!data.hasData) {
        return (
          <div className="bg-gray-900 text-white p-3 rounded-xl shadow-xl border border-gray-800">
            <p className="font-bold text-sm mb-1">{data.name} ({data.date})</p>
            <p className="text-gray-400 text-xs">No data logged</p>
          </div>
        );
      }
      return (
        <div className="bg-gray-900 text-white p-3 rounded-xl shadow-xl border border-gray-800">
          <p className="font-bold text-sm mb-1">{data.name} ({data.date})</p>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
            <p className="text-gray-200 text-sm">{data.calories} kcal</p>
          </div>
        </div>
      );
    }
    return null;
  };`;

code = code.replace(tooltipRegex, newTooltip);

fs.writeFileSync('src/views/AnalyticsView.tsx', code);
console.log("Patched helpers and tooltip");
