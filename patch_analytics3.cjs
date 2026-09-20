const fs = require('fs');
let code = fs.readFileSync('src/views/AnalyticsView.tsx', 'utf8');

const startIdx = code.indexOf("  const getNextBestMeal = () => {");
const endIdx = code.indexOf("  const getDailyStatus = () => {");

if (startIdx !== -1 && endIdx !== -1) {
  const newNextMealFn = `  const recommendation = RecommendationEngine.getContextualRecommendation(
    settings.profile,
    todayLogs,
    weeklyLogs,
    commonFoods
  );
  const nextMeal = recommendation.food;
  const nextMealAnalysis = nextMeal ? RecommendationEngine.analyzeFood(nextMeal) : null;
  const contextualReason = recommendation.reason;

`;
  
  code = code.substring(0, startIdx) + newNextMealFn + code.substring(endIdx);
  
  const oldReasonJsx = `              {/* Why this recommendation */}
              <div className="mt-4 pt-4 border-t border-gray-100">
                <button 
                  onClick={() => setShowWhyRecommendation(!showWhyRecommendation)}
                  className="flex items-center justify-between w-full text-left"
                >
                  <h4 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                    <Star className="w-4 h-4 text-emerald-500" />
                    Why this recommendation?
                  </h4>
                  <div className={\`transform transition-transform \${showWhyRecommendation ? 'rotate-180' : ''}\`}>
                    <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>
                
                <AnimatePresence>
                  {showWhyRecommendation && nextMealAnalysis && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-4 space-y-3">
                        <div className="flex items-start gap-3 bg-gray-50 p-3 rounded-xl">
                          <Target className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                          <div>
                            <p className="text-xs font-bold text-gray-700">Goal Alignment</p>
                            <p className="text-sm text-gray-600">{RecommendationEngine.evaluateGoalCompatibility(nextMeal, settings.profile?.primaryGoal || '').reason}</p>
                          </div>
                        </div>`;

const newReasonJsx = `              {/* Why this recommendation */}
              <div className="mt-4 pt-4 border-t border-gray-100">
                <button 
                  onClick={() => setShowWhyRecommendation(!showWhyRecommendation)}
                  className="flex items-center justify-between w-full text-left"
                >
                  <h4 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                    <Star className="w-4 h-4 text-emerald-500" />
                    Why this recommendation?
                  </h4>
                  <div className={\`transform transition-transform \${showWhyRecommendation ? 'rotate-180' : ''}\`}>
                    <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>
                
                <AnimatePresence>
                  {showWhyRecommendation && nextMealAnalysis && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-4 space-y-3">
                        <div className="flex items-start gap-3 bg-blue-50 p-3 rounded-xl border border-blue-100">
                          <Info className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                          <div>
                            <p className="text-xs font-bold text-blue-800">Contextual Fit</p>
                            <p className="text-sm text-blue-900">{contextualReason}</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3 bg-gray-50 p-3 rounded-xl">
                          <Target className="w-4 h-4 text-gray-500 mt-0.5 shrink-0" />
                          <div>
                            <p className="text-xs font-bold text-gray-700">Goal Alignment</p>
                            <p className="text-sm text-gray-600">{RecommendationEngine.evaluateGoalCompatibility(nextMeal, settings.profile?.primaryGoal || '').reason}</p>
                          </div>
                        </div>`;
  
  if (code.includes(oldReasonJsx)) {
    code = code.replace(oldReasonJsx, newReasonJsx);
  } else {
    console.log("oldReasonJsx not found.");
  }
  
  fs.writeFileSync('src/views/AnalyticsView.tsx', code);
  console.log("Patched AnalyticsView");
} else {
  console.log("Not found.");
}
