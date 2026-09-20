const fs = require('fs');
let code = fs.readFileSync('src/views/LogFoodView.tsx', 'utf8');

code = code.replace(
  '{initialRecord ? "Save Changes" : `Log to ${mealCategory}`}',
  '{initialRecord ? "Save Changes" : `Add to ${mealCategory}`}'
);

fs.writeFileSync('src/views/LogFoodView.tsx', code);
console.log("Updated CTA label.");
