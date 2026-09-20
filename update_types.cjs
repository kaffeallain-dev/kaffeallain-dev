const fs = require('fs');
let code = fs.readFileSync('src/types.ts', 'utf8');

if (!code.includes('CompositeMealTemplate')) {
  code = code.replace(
    'export interface CustomFoodTemplate extends FoodItemTemplate {',
    `export interface CompositeMealTemplate extends FoodItemTemplate {
  isComposite: true;
  components: string[]; // IDs or names of the component foods
}

export interface CustomFoodTemplate extends FoodItemTemplate {`
  );
  fs.writeFileSync('src/types.ts', code);
  console.log("Added CompositeMealTemplate to types.ts");
} else {
  console.log("Already present");
}
