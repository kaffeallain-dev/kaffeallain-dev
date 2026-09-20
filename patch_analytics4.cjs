const fs = require('fs');
let code = fs.readFileSync('src/views/AnalyticsView.tsx', 'utf8');

const oldWhy = `<div className="pt-4 space-y-4 text-sm text-gray-600">
                      <div>
                        <span className="font-bold text-gray-900 block mb-0.5">Your goal</span>`;

const newWhy = `<div className="pt-4 space-y-4 text-sm text-gray-600">
                      <div className="bg-blue-50/50 -mx-2 px-2 py-2 rounded-lg border border-blue-100/50">
                        <span className="font-bold text-blue-900 block mb-0.5 flex items-center gap-1">
                          <Info className="w-3.5 h-3.5" />
                          Contextual Fit
                        </span>
                        <span className="text-blue-800">{contextualReason}</span>
                      </div>
                      <div>
                        <span className="font-bold text-gray-900 block mb-0.5">Your goal</span>`;

if (code.includes(oldWhy)) {
  code = code.replace(oldWhy, newWhy);
  fs.writeFileSync('src/views/AnalyticsView.tsx', code);
  console.log("Patched AnalyticsView");
} else {
  console.log("oldWhy not found.");
}
