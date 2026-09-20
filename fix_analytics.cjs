const fs = require('fs');
let code = fs.readFileSync('src/views/AnalyticsView.tsx', 'utf8');

// 1. ADD STATE
if (!code.includes("showWhyRecommendation")) {
  code = code.replace(
    "const [isUpdating, setIsUpdating] = useState(false);",
    "const [isUpdating, setIsUpdating] = useState(false);\n  const [showWhyRecommendation, setShowWhyRecommendation] = useState(false);"
  );
}

// 2. ADD NEXT MEAL ANALYSIS
if (!code.includes("nextMealAnalysis")) {
  code = code.replace(
    "const nextMeal = getNextBestMeal();",
    "const nextMeal = getNextBestMeal();\n  const nextMealAnalysis = nextMeal ? RecommendationEngine.analyzeFood(nextMeal) : null;"
  );
}

// 3. REPLACE DAILY FOCUS
const oldDailyFocus = `        {/* Today's Focus */}
        <motion.div 
          animate={isUpdating ? { y: [-2, 2, 0] } : {}}
          className="bg-blue-600 p-6 rounded-3xl shadow-lg shadow-blue-200 text-white relative overflow-hidden"
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

const newDailyFocus = `        {/* Today's Focus */}
        <motion.div 
          animate={isUpdating ? { y: [-2, 2, 0] } : {}}
          className="bg-white p-6 rounded-3xl border border-emerald-100 shadow-sm relative overflow-hidden mb-2"
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

code = code.replace(oldDailyFocus, newDailyFocus);

// 4. REPLACE COACH SUGGESTION
const coachSuggestionRegex = /\{\/\* Next Best Meal Recommendation \*\/\}[\s\S]*?(?=\{\/\* Nutrition Gaps & Trends \*\/)/;

const newCoachSuggestion = `{/* Next Best Meal Recommendation */}
        {nextMeal && nextMealAnalysis && (
          <div className="bg-white border border-gray-100 p-6 rounded-3xl mt-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900 text-sm uppercase tracking-wider flex items-center gap-2">
                <Utensils className="w-4 h-4 text-emerald-500" />
                Your Next Meal
              </h3>
            </div>
            
            <div className="mb-4">
              <h4 className="font-bold text-gray-900 text-2xl tracking-tight mb-1">{nextMeal.name}</h4>
              <div className="flex items-center gap-2 text-sm text-gray-500 mb-3 font-medium">
                <span>{nextMeal.servingSizeText}</span>
                <span>•</span>
                <span>~{nextMeal.calories} kcal</span>
              </div>
              
              <p className="text-sm text-gray-700 leading-relaxed mb-5">
                {gap.includes('Vegetables') ? 'Recommended because it can help add more vegetables and fiber to your meals today.' : 
                 settings.profile?.primaryGoal === 'Build Muscle' ? 'Recommended because it offers a solid protein boost to support your goals.' :
                 settings.profile?.primaryGoal === 'Lose Weight' ? 'Recommended because it is light, nutrient-dense, and fits your calorie target.' :
                 'Recommended because it provides a good balance of nutrients familiar to you.'}
              </p>
              
              <div className="flex items-center gap-3 mb-2">
                <button 
                  onClick={onLogFood}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 px-4 rounded-xl transition-colors text-sm text-center shadow-sm"
                >
                  Try this
                </button>
                <button 
                  className="px-5 py-3.5 bg-gray-50 hover:bg-gray-100 text-gray-600 font-bold rounded-xl transition-colors text-sm border border-gray-100"
                >
                  See alternatives
                </button>
              </div>
            </div>
            
            <div className="pt-2 border-t border-gray-50 mt-5">
              <button 
                onClick={() => setShowWhyRecommendation(!showWhyRecommendation)}
                className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center justify-between w-full hover:text-gray-600 transition-colors py-2"
              >
                Why this recommendation?
                <svg className={\`w-4 h-4 transition-transform \${showWhyRecommendation ? 'rotate-180' : ''}\`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              
              <AnimatePresence>
                {showWhyRecommendation && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="pt-4 space-y-4 text-sm text-gray-600">
                      <div>
                        <span className="font-bold text-gray-900 block mb-0.5">Your goal</span>
                        Supports your current goal to {settings.profile?.primaryGoal || 'Eat Healthier'}.
                      </div>
                      
                      <div>
                        <span className="font-bold text-gray-900 block mb-0.5">Your recent pattern</span>
                        {todayLogs.length > 0 ? 
                          (gap.includes('Vegetables') ? 'Your meals today have been light on vegetables.' : 
                           gap.includes('Protein') ? 'Your protein intake is slightly below average today.' : 
                           gap.includes('Water') ? 'You recently had sugary drinks and might need hydration.' : 
                           'Your meals have lacked some healthy fats and minerals.')
                          : 'Based on what you\\'ve logged so far, we don\\'t have a clear pattern for today yet.'
                        }
                      </div>
                      
                      <div>
                        <span className="font-bold text-gray-900 block mb-0.5">Why this food</span>
                        {nextMealAnalysis.goodSourceOf.length > 0 ? 
                          \`This meal is a great source of \${nextMealAnalysis.goodSourceOf.join(', ').toLowerCase()}.\` : 
                          'This meal balances your current nutritional gap effectively.'
                        }
                      </div>
                      
                      <div>
                        <span className="font-bold text-gray-900 block mb-0.5">Confidence</span>
                        {currentSummary.confidence > 70 ? 'High confidence · Based on your recent logs and nutritional profile.' :
                         currentSummary.confidence > 30 ? 'Moderate confidence · We are still learning your eating patterns.' :
                         'Limited confidence · We don\\'t have enough recent meal data yet.'}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}
        
        `;

code = code.replace(coachSuggestionRegex, newCoachSuggestion);

fs.writeFileSync('src/views/AnalyticsView.tsx', code);
console.log("AnalyticsView modified.");
