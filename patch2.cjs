const fs = require('fs');
let code = fs.readFileSync('src/views/AnalyticsView.tsx', 'utf8');

const logicToAdd = `  const getDailyStatus = () => {
    if (todayLogs.length === 0) {
      return {
        title: "Your day is still taking shape",
        message: "Log a meal to help MboaFit understand your eating pattern.",
        colorClass: "bg-gray-50 border-gray-100 text-gray-600"
      };
    }
    if (todayLogs.length === 1) {
      return {
        title: "Your day is still taking shape",
        message: "You've made a start. Log your next meal to see your daily pattern.",
        colorClass: "bg-gray-50 border-gray-100 text-gray-600"
      };
    }
    
    const protein = todayLogs.reduce((sum, m) => sum + (m.protein || 0), 0);
    const sugary = todayLogs.filter(m => m.name.toLowerCase().includes('coke') || m.name.toLowerCase().includes('soda') || m.name.toLowerCase().includes('juice'));
    const vegMeals = todayLogs.filter(m => m.name.toLowerCase().includes('eru') || m.name.toLowerCase().includes('ndolé') || m.name.toLowerCase().includes('salad') || m.name.toLowerCase().includes('veg'));
    const goal = settings.profile?.primaryGoal || 'Eat Healthier';
    
    if (sugary.length > 0 || (vegMeals.length === 0 && todayLogs.length > 2)) {
      return {
        title: "One thing could improve today",
        message: "A small adjustment could help balance your nutrition.",
        colorClass: "bg-amber-50 border-amber-100 text-amber-800"
      };
    }
    if (goal === 'Lose Weight' && remaining >= 0) {
      return {
        title: "You're doing well today",
        message: "You are within your calorie target so far.",
        colorClass: "bg-emerald-50 border-emerald-100 text-emerald-800"
      };
    }
    if (goal === 'Build Muscle' && protein > 20) {
      return {
        title: "You're making a solid start today",
        message: "Your logged meals are supporting your protein goals.",
        colorClass: "bg-emerald-50 border-emerald-100 text-emerald-800"
      };
    }
    return {
      title: "Your day looks balanced so far",
      message: "Your logged meals are reasonably varied today.",
      colorClass: "bg-emerald-50 border-emerald-100 text-emerald-800"
    };
  };

  const getFoodPattern = () => {
    if (todayLogs.length === 0) return null;

    const sugary = todayLogs.filter(m => m.name.toLowerCase().includes('coke') || m.name.toLowerCase().includes('soda') || m.name.toLowerCase().includes('juice'));
    const vegMeals = todayLogs.filter(m => m.name.toLowerCase().includes('eru') || m.name.toLowerCase().includes('ndolé') || m.name.toLowerCase().includes('salad') || m.name.toLowerCase().includes('veg'));
    const fried = todayLogs.filter(m => m.name.toLowerCase().includes('fried') || m.name.toLowerCase().includes('puff'));
    const highProtein = todayLogs.filter(m => (m.protein || 0) > 15);
    
    if (vegMeals.length === 0 && todayLogs.length >= 1) {
       return {
         status: "Needs attention",
         observation: "Vegetables haven't appeared in the meals you've logged today.",
         whyItMatters: "Vegetables provide essential fiber to keep you full and micronutrients for energy.",
         whatNext: "Adding one vegetable-rich side to your next meal could improve variety.",
         icon: AlertTriangle,
         colorClass: "text-amber-600 bg-amber-50 border-amber-100"
       };
    }
    
    if (sugary.length > 0) {
       return {
         status: "Needs attention",
         observation: \`You've logged \${sugary.length} sugary drink\${sugary.length > 1 ? 's' : ''} today.\`,
         whyItMatters: "Sugary drinks can cause energy crashes and add hidden calories without making you full.",
         whatNext: "Consider having water with your next meal instead.",
         icon: AlertTriangle,
         colorClass: "text-amber-600 bg-amber-50 border-amber-100"
       };
    }
    
    if (fried.length > 1) {
       return {
         status: "Needs attention",
         observation: "You've had multiple fried foods today.",
         whyItMatters: "Fried foods are calorie-dense and can make you feel sluggish.",
         whatNext: "Opt for a boiled or grilled option for your next meal.",
         icon: AlertTriangle,
         colorClass: "text-amber-600 bg-amber-50 border-amber-100"
       };
    }
    
    if (highProtein.length >= 1) {
       return {
         status: "Positive pattern",
         observation: "Your logged meals have included strong protein sources.",
         whyItMatters: "Protein helps with satiety and supports muscle recovery.",
         whatNext: "Keep up the balanced choices for the rest of the day.",
         icon: Star,
         colorClass: "text-emerald-600 bg-emerald-50 border-emerald-100"
       };
    }
    
    return {
       status: "Developing pattern",
       observation: "Your meals show a mix of different foods today.",
       whyItMatters: "A varied diet is key to getting a wide range of nutrients.",
       whatNext: "Keep logging to maintain a clear picture of your day.",
       icon: Info,
       colorClass: "text-blue-600 bg-blue-50 border-blue-100"
    };
  };

  const dailyStatus = getDailyStatus();
  const foodPattern = getFoodPattern();`;

code = code.replace(
  'const nextMealAnalysis = nextMeal ? RecommendationEngine.analyzeFood(nextMeal) : null;',
  'const nextMealAnalysis = nextMeal ? RecommendationEngine.analyzeFood(nextMeal) : null;\n\n' + logicToAdd
);

// Now, replace the JSX block.
// We are replacing from {/* Daily Summary Card */} to just before {/* Next Best Meal Recommendation */}

const oldJsxRegex = /\{\/\* Daily Summary Card \*\/\}[\s\S]*?(?=\{\/\* Next Best Meal Recommendation \*\/)/;

const newJsx = `{/* TODAY / DAILY PROGRESS */}
        <motion.div 
          animate={isUpdating ? { scale: [1, 1.02, 1] } : {}}
          transition={{ duration: 0.5 }}
          className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 relative overflow-hidden"
        >
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">Today</h3>
          
          <div className="flex justify-between items-end mb-5">
            <div>
              <p className="text-3xl font-black text-gray-900 leading-none tracking-tight">{remaining > 0 ? remaining : 0}</p>
              <p className="text-sm font-medium text-gray-500 mt-1">kcal remaining</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold text-gray-700">{Math.round(caloriesConsumed)} <span className="text-gray-400 font-medium">consumed</span></p>
              <p className="text-sm font-bold text-gray-700">{settings.dailyGoal} <span className="text-gray-400 font-medium">target</span></p>
            </div>
          </div>
          
          <div className={\`p-3.5 rounded-2xl border \${dailyStatus.colorClass}\`}>
             <p className="text-sm font-bold mb-0.5">{dailyStatus.title}</p>
             <p className="text-xs opacity-90 font-medium">{dailyStatus.message}</p>
          </div>
        </motion.div>

        {/* YOUR FOOD PATTERN */}
        {foodPattern && (
          <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">Your Food Pattern</h3>
              <span className={\`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full \${foodPattern.colorClass}\`}>
                {foodPattern.status}
              </span>
            </div>
            
            <div className="flex items-start gap-4 mb-4">
              <div className={\`p-2.5 rounded-xl shrink-0 mt-0.5 \${foodPattern.colorClass}\`}>
                <foodPattern.icon className="w-5 h-5" />
              </div>
              <div>
                <p className="font-bold text-gray-900 text-lg leading-tight mb-2 tracking-tight">
                  {foodPattern.observation}
                </p>
                <p className="text-sm text-gray-600 leading-relaxed">
                  <span className="font-bold text-gray-700">Why it matters:</span> {foodPattern.whyItMatters}
                </p>
              </div>
            </div>
            
            <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
              <p className="text-sm text-gray-700"><span className="font-bold">Focus:</span> {foodPattern.whatNext}</p>
            </div>
          </div>
        )}
        
        `;

code = code.replace(oldJsxRegex, newJsx);

fs.writeFileSync('src/views/AnalyticsView.tsx', code);
console.log("AnalyticsView patched.");
