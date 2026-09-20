const fs = require('fs');
let code = fs.readFileSync('src/lib/RecommendationEngine.ts', 'utf8');

const oldReasons = `        // Generate contextual reason
        if (missingVeggies && isVeggie) {
          bestReason = "You haven't logged many vegetables today. This is a great, flavorful way to add fiber.";
          actionType = "New Meal";
        } else if (highFried && isBoiledOrGrilled) {
          bestReason = "Since you had a heavier meal earlier, this lighter preparation will help balance your daily energy.";
          actionType = "Modify Preparation";
        } else if (lowProtein && isHighProtein) {
          bestReason = "This supports your muscle-building goal by adding a strong source of protein.";
          actionType = "New Meal";
        } else if (compatibility.level === 'Excellent') {
          bestReason = compatibility.reason;
          actionType = "New Meal";
        } else {
          bestReason = "This adds good variety to your recent meal pattern.";
          actionType = "New Meal";
        }`;

const newReasons = `        // Generate contextual reason
        if (missingVeggies && isVeggie) {
          bestReason = "Recommended because it can add vegetables and fiber to your meals today.";
          actionType = "New Meal";
        } else if (highFried && isBoiledOrGrilled) {
          bestReason = "Recommended because choosing a lighter preparation can help balance your meals today.";
          actionType = "Modify Preparation";
        } else if (lowProtein && isHighProtein) {
          bestReason = "Recommended because it adds a convenient source of protein to your next meal.";
          actionType = "New Meal";
        } else if (compatibility.level === 'Excellent') {
          bestReason = \`Recommended because it aligns with your goal: \${compatibility.reason.toLowerCase()}\`;
          actionType = "New Meal";
        } else {
          bestReason = "Recommended because it adds good variety to your recent meal pattern.";
          actionType = "New Meal";
        }`;

if (code.includes(oldReasons)) {
  code = code.replace(oldReasons, newReasons);
  fs.writeFileSync('src/lib/RecommendationEngine.ts', code);
  console.log("Patched RecommendationEngine reasons");
} else {
  console.log("oldReasons not found");
}
