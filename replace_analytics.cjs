const fs = require('fs');
let code = fs.readFileSync('src/views/AnalyticsView.tsx', 'utf8');

// 1. Add showWhyRecommendation state
code = code.replace(
  "const [isUpdating, setIsUpdating] = useState(false);",
  "const [isUpdating, setIsUpdating] = useState(false);\n  const [showWhyRecommendation, setShowWhyRecommendation] = useState(false);"
);

// 2. Add nextMealAnalysis definition
code = code.replace(
  "const nextMeal = getNextBestMeal();",
  "const nextMeal = getNextBestMeal();\n  const nextMealAnalysis = nextMeal ? RecommendationEngine.analyzeFood(nextMeal) : null;"
);

// 3. Replace Daily Focus block
const oldDailyFocus = `<motion.div 
          animate={isUpdating ? { scale: [1, 1.02, 1] } : {}}
          className="bg-blue-600 p-6 rounded-3xl text-white relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 p-4 opacity-20">
            <Target className="w-24 h-24" />
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-3">
              <div className="bg-white/20 p-1.5 rounded-lg">
                <Zap className="w-4 h-4 text-white" />
              </div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-blue-100">Daily Focus</h3>
            </div>
            <p className="text-lg font-bold leading-tight">{currentSummary.nextAction.title}</p>
            <p className="text-sm text-blue-100 mt-2">{currentSummary.nextAction.description}</p>
          </div>
        </motion.div>`;

const newDailyFocus = `<motion.div 
          animate={isUpdating ? { scale: [1, 1.02, 1] } : {}}
          className="bg-white p-6 rounded-3xl border border-emerald-100 shadow-sm relative overflow-hidden"
        >
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-3">
              <div className="bg-emerald-50 p-1.5 rounded-lg border border-emerald-100/50">
                <Zap className="w-4 h-4 text-emerald-600" />
              </div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-800">Daily Focus</h3>
            </div>
            <p className="text-xl font-bold text-gray-900 leading-tight tracking-tight mb-2">
              {currentSummary.nextAction.title}
            </p>
            <p className="text-sm text-gray-600 leading-relaxed">
              {currentSummary.nextAction.description}
            </p>
          </div>
        </motion.div>`;

if (code.includes(oldDailyFocus)) {
  code = code.replace(oldDailyFocus, newDailyFocus);
  console.log("Replaced Daily Focus exactly.");
} else {
  console.log("Could not find oldDailyFocus block exactly, trying more flexible match...");
  // Let's use a regex to replace between `<motion.div` and `        {/* Daily Summary Card */}`
  const dailyFocusRegex = /<motion\.div\s+animate=\{isUpdating \? \{ scale: \[1, 1\.02, 1\] \} : \{\}\}\s+className="bg-blue-600[^]+?<\/motion\.div>/m;
  if (dailyFocusRegex.test(code)) {
    code = code.replace(dailyFocusRegex, newDailyFocus);
    console.log("Replaced Daily Focus via regex.");
  } else {
    console.log("Failed to replace Daily Focus.");
  }
}

fs.writeFileSync('src/views/AnalyticsView.tsx', code);
