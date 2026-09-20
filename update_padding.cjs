const fs = require('fs');
let code = fs.readFileSync('src/views/LogFoodView.tsx', 'utf8');

// The main return container for search list
// <div className="max-w-md mx-auto w-full bg-white flex flex-col h-full min-h-screen pb-24">
code = code.replace(
  '<div className="max-w-md mx-auto w-full bg-white flex flex-col h-full min-h-screen pb-24">',
  '<div className="max-w-md mx-auto w-full bg-white flex flex-col h-full min-h-screen pb-32">'
);

fs.writeFileSync('src/views/LogFoodView.tsx', code);
console.log("Updated padding.");
