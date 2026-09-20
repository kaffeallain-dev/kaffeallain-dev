const fs = require('fs');
let code = fs.readFileSync('src/views/SettingsView.tsx', 'utf8');

const target1 = `    <div className="max-w-md mx-auto w-full p-6 pb-24">`;
const replacement1 = `    <div className="max-w-md mx-auto w-full p-6 pb-40">`;

const target2 = `          <div className="flex items-center justify-between p-4 bg-gray-50 border border-gray-100 rounded-2xl">
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
          </div>`;

const replacement2 = `          <div className="flex flex-col sm:flex-row sm:items-start sm:items-center justify-between p-4 bg-gray-50 border border-gray-100 rounded-2xl gap-4">
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
              className="w-full sm:w-auto px-4 py-2 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 font-semibold rounded-xl text-sm transition-colors shadow-sm flex items-center justify-center gap-2"
            >
              <Calculator className="w-4 h-4 shrink-0" />
              Auto-Calculate
            </button>
          </div>`;

if (code.includes(target1)) {
  code = code.replace(target1, replacement1);
  console.log("Replaced target 1");
} else {
  console.log("target 1 not found");
}

if (code.includes(target2)) {
  code = code.replace(target2, replacement2);
  console.log("Replaced target 2");
} else {
  console.log("target 2 not found");
}

fs.writeFileSync('src/views/SettingsView.tsx', code);
