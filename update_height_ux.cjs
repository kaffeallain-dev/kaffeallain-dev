const fs = require('fs');
const path = './src/views/OnboardingView.tsx';
let code = fs.readFileSync(path, 'utf8');

// Replace toggleHeightUnit with selectHeightUnit
code = code.replace(
  /const toggleHeightUnit = \(\) => {[\s\S]*?};\n/,
  `const selectHeightUnit = (unit: 'cm' | 'ft') => {
    if (heightUnit === unit) return;
    
    if (unit === 'ft') {
      if (profile.heightCm) {
        const totalInches = profile.heightCm / 2.54;
        setHeightFt(Math.floor(totalInches / 12));
        setHeightIn(Math.round(totalInches % 12));
      } else {
        setHeightFt('');
        setHeightIn('');
      }
    }
    setHeightUnit(unit);
    setHeightError('');
  };\n`
);

// Update validation
code = code.replace(
  /setHeightError\('Please check your height and unit\.'\);/,
  `if (heightUnit === 'cm' && profile.heightCm >= 30 && profile.heightCm < 100) {
          setHeightError(\`\${profile.heightCm} cm looks unusually low. Check your height or switch to ft/in.\`);
        } else {
          setHeightError('Please enter a valid height.');
        }`
);

// Update render height section
code = code.replace(
  /<button onClick={toggleHeightUnit} className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">\s*\{heightUnit === 'cm' \? 'Switch to ft\/in' : 'Switch to cm'\}\s*<\/button>/,
  `<div className="flex bg-gray-100 rounded-lg p-0.5 shrink-0">
              <button 
                onClick={() => selectHeightUnit('cm')} 
                className={\`px-3 py-1.5 text-xs font-bold rounded-md transition-colors \${heightUnit === 'cm' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}\`}
              >
                cm
              </button>
              <button 
                onClick={() => selectHeightUnit('ft')} 
                className={\`px-3 py-1.5 text-xs font-bold rounded-md transition-colors \${heightUnit === 'ft' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}\`}
              >
                ft/in
              </button>
            </div>`
);

// Add placeholder to cm input
code = code.replace(
  /value=\{profile.heightCm \|\| ''\}\n\s*onChange=\{e => handleHeightCmChange\(e\.target\.value\)\}/,
  `placeholder="e.g. 170"\n                value={profile.heightCm || ''}\n                onChange={e => handleHeightCmChange(e.target.value)}`
);

// Add placeholders to ft input
code = code.replace(
  /value=\{heightFt\}\n\s*onChange=\{e => handleHeightFtChange\(e\.target\.value\)\}/,
  `placeholder="5"\n                  value={heightFt}\n                  onChange={e => handleHeightFtChange(e.target.value)}`
);

code = code.replace(
  /value=\{heightIn\}\n\s*onChange=\{e => handleHeightInChange\(e\.target\.value\)\}/,
  `placeholder="9"\n                  value={heightIn}\n                  onChange={e => handleHeightInChange(e.target.value)}`
);

fs.writeFileSync(path, code);
