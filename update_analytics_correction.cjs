const fs = require('fs');
let code = fs.readFileSync('src/views/AnalyticsView.tsx', 'utf8');

// Update pb-24 to pb-40
code = code.replace(
  '<div className="max-w-md mx-auto w-full p-6 pb-24 space-y-6">',
  '<div className="max-w-md mx-auto w-full p-6 pb-40 space-y-6">'
);

// Update onLogFood type
code = code.replace(
  'export default function AnalyticsView({ onLogFood }: { onLogFood: () => void }) {',
  'export default function AnalyticsView({ onLogFood }: { onLogFood: (food?: any) => void }) {'
);

fs.writeFileSync('src/views/AnalyticsView.tsx', code);
console.log("Updated basic changes.");
