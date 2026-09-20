const fs = require('fs');

let code = fs.readFileSync('src/views/SettingsView.tsx', 'utf8');

const oldSection = `<section id="edit-profile-section" className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <User className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-gray-900">Edit Profile</h2>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-600 uppercase">Age</label>
              <input
                type="number"
                value={profile.age || ''}
                onChange={e => setProfile({...profile, age: parseInt(e.target.value) || undefined})}
                placeholder="Years"
                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-600 uppercase">Sex</label>
              <select
                value={profile.sex}
                onChange={e => setProfile({...profile, sex: e.target.value as any})}
                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
              >
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-600 uppercase">Height (cm)</label>
              <input
                type="number"
                value={profile.heightCm || ''}
                onChange={e => setProfile({...profile, heightCm: parseInt(e.target.value) || undefined})}
                placeholder="cm"
                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-600 uppercase">Weight (kg)</label>
              <input
                type="number"
                value={profile.weightKg || ''}
                onChange={e => setProfile({...profile, weightKg: parseInt(e.target.value) || undefined})}
                placeholder="kg"
                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-600 uppercase">Target Wt. (kg)</label>
              <input
                type="number"
                value={profile.targetWeightKg || ''}
                onChange={e => setProfile({...profile, targetWeightKg: parseInt(e.target.value) || undefined})}
                placeholder="kg"
                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-1 gap-4 mt-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-600 uppercase">Primary Goal</label>
              <select
                value={profile.primaryGoal}
                onChange={e => setProfile({...profile, primaryGoal: e.target.value as any})}
                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
              >
                <option value="Lose Weight">Lose Weight</option>
                <option value="Maintain Weight">Maintain Weight</option>
                <option value="Gain Weight">Gain Weight</option>
                <option value="Build Muscle">Build Muscle</option>
                <option value="Eat Healthier">Eat Healthier</option>
              </select>
            </div>
          </div>

          <div className="space-y-2 mt-4">
            <label className="text-xs font-semibold text-gray-600 uppercase">Activity Level</label>
            <select
              value={profile.activityLevel}
              onChange={e => setProfile({...profile, activityLevel: e.target.value as any})}
              className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
            >
              <option value="Sedentary">Sedentary (Little or no exercise)</option>
              <option value="Lightly Active">Lightly Active (Exercise 1-3 days/wk)</option>
              <option value="Moderately Active">Moderately Active (Exercise 3-5 days/wk)</option>
              <option value="Very Active">Very Active (Hard exercise & physical job)</option>
            </select>
          </div>
          
          <button
            onClick={calculateGoal}
            className="w-full mt-2 flex items-center justify-center gap-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold py-3 px-4 rounded-xl transition-colors"
          >
            <Calculator className="w-5 h-5" />
            Auto-Calculate Daily Nutrition Goal
          </button>
        </section>`;

const newSection = `<section id="edit-profile-section" className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <User className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-gray-900">Edit Profile</h2>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-gray-800">Age <span className="text-gray-400 font-normal">(years)</span></label>
              <input
                type="number"
                inputMode="numeric"
                pattern="[0-9]*"
                value={profile.age || ''}
                onChange={e => setProfile({...profile, age: parseInt(e.target.value) || undefined})}
                placeholder="e.g. 30"
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-gray-800">Sex</label>
              <select
                value={profile.sex}
                onChange={e => setProfile({...profile, sex: e.target.value as any})}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors appearance-none"
              >
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-gray-800">Height <span className="text-gray-400 font-normal">(cm)</span></label>
              <input
                type="number"
                inputMode="numeric"
                pattern="[0-9]*"
                value={profile.heightCm || ''}
                onChange={e => setProfile({...profile, heightCm: parseInt(e.target.value) || undefined})}
                placeholder="e.g. 175"
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-gray-800">Weight <span className="text-gray-400 font-normal">(kg)</span></label>
              <input
                type="number"
                inputMode="numeric"
                pattern="[0-9]*"
                value={profile.weightKg || ''}
                onChange={e => setProfile({...profile, weightKg: parseInt(e.target.value) || undefined})}
                placeholder="e.g. 70"
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-gray-800">Target weight <span className="text-gray-400 font-normal">(kg)</span></label>
              <input
                type="number"
                inputMode="numeric"
                pattern="[0-9]*"
                value={profile.targetWeightKg || ''}
                onChange={e => setProfile({...profile, targetWeightKg: parseInt(e.target.value) || undefined})}
                placeholder="e.g. 65"
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-gray-800">Primary goal</label>
              <select
                value={profile.primaryGoal}
                onChange={e => setProfile({...profile, primaryGoal: e.target.value as any})}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors appearance-none"
              >
                <option value="Lose Weight">Lose Weight</option>
                <option value="Maintain Weight">Maintain Weight</option>
                <option value="Gain Weight">Gain Weight</option>
                <option value="Build Muscle">Build Muscle</option>
                <option value="Eat Healthier">Eat Healthier</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-gray-800">Activity level</label>
            <select
              value={profile.activityLevel}
              onChange={e => setProfile({...profile, activityLevel: e.target.value as any})}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors truncate pr-8 appearance-none"
            >
              <option value="Sedentary">Sedentary (Little/no exercise)</option>
              <option value="Lightly Active">Lightly Active (1-3 days/wk)</option>
              <option value="Moderately Active">Moderately Active (3-5 days/wk)</option>
              <option value="Very Active">Very Active (Hard physical effort)</option>
            </select>
          </div>
          
          <div className="pt-2 flex flex-col gap-3">
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

if (code.includes(oldSection)) {
  code = code.replace(oldSection, newSection);
  fs.writeFileSync('src/views/SettingsView.tsx', code);
  console.log('Successfully patched Edit Profile section');
} else {
  console.log('Could not find target block to replace.');
}
