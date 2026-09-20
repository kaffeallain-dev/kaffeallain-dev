const fs = require('fs');
const path = './src/views/OnboardingView.tsx';
let code = fs.readFileSync(path, 'utf8');

// Replace the main wrapper to use h-[100dvh]
code = code.replace(
  'min-h-screen bg-emerald-50 flex flex-col items-center justify-center p-6 pb-safe"',
  'h-[100dvh] bg-emerald-50 flex flex-col items-center justify-center p-4 sm:p-6 pb-safe overflow-hidden"'
);

// Update step 1 card just in case
code = code.replace(
  'className="bg-white p-6 rounded-3xl shadow-xl w-full max-w-sm flex flex-col my-auto"',
  'className="bg-white p-6 rounded-3xl shadow-xl w-full max-w-sm flex flex-col my-auto max-h-full"'
);

// We need to modify renderSubStep1, renderSubStep2, renderSubStep3
const subStepRegex = /(const renderSubStep\d = \(\) => \([\s\S]*?<motion\.div[\s\S]*?className=")([^"]+)("[\s\S]*?>\s*)([\s\S]*?)(<div className="mt-auto pt-4 flex flex-col gap-3 border-t border-gray-100">[\s\S]*?<\/div>\s*<\/motion\.div>\s*\);)/g;

code = code.replace(subStepRegex, (match, p1, classes, p3, content, p5) => {
  // Update classes for the card to use max-h-full and flex flex-col
  const newClasses = classes.replace('p-6', '').replace('relative', 'max-h-full overflow-hidden');
  
  // Now we need to split content into header and scrollable body.
  // The header usually contains renderStep2Progress() and a div with mb-6 for title.
  // We can just wrap the first two top-level elements in a shrink-0 header,
  // and the rest in an overflow-y-auto div.
  
  // Let's use a more robust replacement strategy for each sub-step.
  return match; // Don't replace globally like this, let's do it specifically.
});

fs.writeFileSync(path, code);
