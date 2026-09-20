const fs = require('fs');
let code = fs.readFileSync('src/views/LogFoodView.tsx', 'utf8');

code = code.replace(
  '<p className="text-gray-500 mb-4">No foods found for "{searchQuery}"</p>',
  '<h3 className="text-lg font-bold text-gray-900 mb-2">No matching food found</h3>\n              <p className="text-gray-500 mb-6">Try another name or add it manually.</p>'
);

code = code.replace(
  'gap-x-4 gap-y-3',
  'gap-x-4 gap-y-4'
);

fs.writeFileSync('src/views/LogFoodView.tsx', code);
console.log("Updated no results.");
