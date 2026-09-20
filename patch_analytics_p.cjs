const fs = require('fs');
let code = fs.readFileSync('src/views/AnalyticsView.tsx', 'utf8');

const oldP = `<p className="text-sm text-gray-700 leading-relaxed mb-5">
                {gap.includes('Vegetables') ? 'Recommended because it can help add more vegetables and fiber to your meals today.' : 
                 settings.profile?.primaryGoal === 'Build Muscle' ? 'Recommended because it offers a solid protein boost to support your goals.' :
                 settings.profile?.primaryGoal === 'Lose Weight' ? 'Recommended because it is light, nutrient-dense, and fits your calorie target.' :
                 'Recommended because it provides a good balance of nutrients familiar to you.'}
              </p>`;

const newP = `<p className="text-sm text-gray-700 leading-relaxed mb-5">
                {contextualReason}
              </p>`;

if (code.includes(oldP)) {
  code = code.replace(oldP, newP);
  fs.writeFileSync('src/views/AnalyticsView.tsx', code);
  console.log("Patched AnalyticsView p tag");
} else {
  console.log("oldP not found");
}
