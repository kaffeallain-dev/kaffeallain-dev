const fs = require('fs');
let code = fs.readFileSync('src/views/SettingsView.tsx', 'utf8');

// 1. Add handleTogglePreference and isTargetAuto
const stateVars = `const [profile, setProfile] = useState<UserProfile>({`;
const toggleFunc = `  const isTargetAuto = parseInt(goal, 10) === calculateDailyTarget(profile);

  const PREFERENCE_OPTIONS = [
    "Vegetarian",
    "Vegan",
    "No Pork",
    "Dairy-Free",
    "High Protein",
    "Low Carb"
  ];

  const handleTogglePreference = (pref: string) => {
    const current = profile.preferences || [];
    if (current.includes(pref)) {
      setProfile({ ...profile, preferences: current.filter(p => p !== pref) });
    } else {
      setProfile({ ...profile, preferences: [...current, pref] });
    }
  };

  const [profile, setProfile] = useState<UserProfile>({
    preferences: settings.profile?.preferences || [],`;

if (code.includes(stateVars)) {
  code = code.replace(stateVars, toggleFunc);
} else {
  console.log("Could not find stateVars");
}

// 2. Remove the old Edit Profile bottom buttons
const oldEditProfileBottom = `          <div className="pt-2 flex flex-col gap-3">
            <button
              onClick={handleSaveGoal}
              className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 px-4 rounded-xl transition-colors shadow-sm"
            >
              {showSavedMsg ? <CheckCircle2 className="w-5 h-5" /> : null}
              {showSavedMsg ? 'Saved' : 'Save Changes'}
            </button>
            <button
              onClick={calculateGoal}
              className="w-full flex items-center justify-center gap-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold py-3 px-4 rounded-xl transition-colors"
            >
              <Calculator className="w-5 h-5" />
              Auto-Calculate Daily Nutrition Goal
            </button>
          </div>
        </section>`;

const newEditProfileBottom = `        </section>`;

if (code.includes(oldEditProfileBottom)) {
  code = code.replace(oldEditProfileBottom, newEditProfileBottom);
} else {
  console.log("Could not find oldEditProfileBottom");
}

// 3. Replace the old Daily Nutrition Goal section with Food Preferences + Daily Nutrition Goal
const oldDailyGoalSection = `        <section className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <Target className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-gray-900">Daily Nutrition Goal</h2>
          </div>
          <div className="flex items-center gap-3 mb-4">
            <input
              type="number"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors"
            />
            <button
              onClick={handleSaveGoal}
              className="bg-gray-900 hover:bg-gray-800 text-white font-medium py-3 px-6 rounded-xl transition-colors shrink-0 flex items-center justify-center min-w-[100px]"
            >
              {showSavedMsg ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : 'Save Profile'}
            </button>
          </div>
          
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 text-sm text-gray-600">
            {isComplete ? (
              <p>This recommendation is based on your age, weight, height, activity level, and your goal of <strong className="text-gray-900">{profile.primaryGoal?.toLowerCase() || 'eating healthier'}</strong>.</p>
            ) : (
              <p>This target is estimated using default values. Complete your profile for higher accuracy.</p>
            )}
          </div>
        </section>`;

const newGoalAndPreferences = `        {/* Food Preferences */}
        <section className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-5">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Food Preferences</h2>
            <p className="text-sm text-gray-500 mt-1">Your preferences help MboaFit suggest meals that fit you better.</p>
          </div>
          
          {(!profile.preferences || profile.preferences.length === 0) && (
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 text-center">
              <p className="text-sm text-gray-600 font-medium">No preferences added yet</p>
              <p className="text-xs text-gray-500 mt-1">Your recommendations will become more tailored as you add preferences.</p>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {PREFERENCE_OPTIONS.map(pref => {
              const isSelected = profile.preferences?.includes(pref);
              return (
                <button
                  key={pref}
                  onClick={() => handleTogglePreference(pref)}
                  className={\`px-4 py-2 rounded-xl text-sm font-semibold transition-colors border \${isSelected ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}\`}
                >
                  {pref}
                </button>
              );
            })}
          </div>
        </section>

        {/* Daily Nutrition Goal */}
        <section className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <Target className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-gray-900">Daily Nutrition Goal</h2>
          </div>
          
          <div className="flex items-center justify-between p-4 bg-gray-50 border border-gray-100 rounded-2xl">
            <div className="flex flex-col">
              <div className="flex items-baseline gap-1">
                <input
                  type="number"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  className="w-24 bg-transparent font-bold text-2xl text-gray-900 focus:outline-none focus:ring-0 p-0"
                  aria-label="Daily calorie goal"
                />
                <span className="text-sm font-medium text-gray-500">kcal/day</span>
              </div>
              <span className="text-xs font-medium text-emerald-600 mt-1">
                {isTargetAuto ? 'Estimated from your profile' : 'Manually set'}
              </span>
            </div>
            
            <button
              onClick={calculateGoal}
              className="px-4 py-2 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 font-semibold rounded-xl text-sm transition-colors shadow-sm whitespace-nowrap"
            >
              Auto-Calculate
            </button>
          </div>

          <p className="text-sm text-gray-600 leading-relaxed px-1">
            {isTargetAuto 
              ? "Your target is currently estimated from basic profile information. Complete your profile to make it more personalized." 
              : "When auto-calculate is enabled, MboaFit calculates your daily target from your profile."}
          </p>

          <div className="pt-4 border-t border-gray-50">
            <button
              onClick={handleSaveGoal}
              className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 px-4 rounded-xl transition-colors shadow-sm"
            >
              {showSavedMsg ? <CheckCircle2 className="w-5 h-5" /> : null}
              {showSavedMsg ? 'Saved' : 'Save All Changes'}
            </button>
          </div>
        </section>`;

if (code.includes(oldDailyGoalSection)) {
  code = code.replace(oldDailyGoalSection, newGoalAndPreferences);
} else {
  console.log("Could not find oldDailyGoalSection");
}

fs.writeFileSync('src/views/SettingsView.tsx', code);
console.log("Patched successfully");
