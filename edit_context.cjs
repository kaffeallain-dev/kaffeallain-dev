const fs = require('fs');
let code = fs.readFileSync('src/context/DataContext.tsx', 'utf8');

if (!code.includes('updateConsumption:')) {
  code = code.replace(
    'addConsumption: (r: ConsumptionRecord) => Promise<void>;',
    'addConsumption: (r: ConsumptionRecord) => Promise<void>;\n  updateConsumption: (r: ConsumptionRecord) => Promise<void>;'
  );
  
  code = code.replace(
    'const handleAddConsumption = async (r: ConsumptionRecord) => {\n    await db.addConsumption(r);\n    await loadData();\n  };',
    'const handleAddConsumption = async (r: ConsumptionRecord) => {\n    await db.addConsumption(r);\n    await loadData();\n  };\n\n  const handleUpdateConsumption = async (r: ConsumptionRecord) => {\n    await db.updateConsumption(r);\n    await loadData();\n  };'
  );

  code = code.replace(
    'addConsumption: handleAddConsumption,',
    'addConsumption: handleAddConsumption,\n      updateConsumption: handleUpdateConsumption,'
  );
  
  fs.writeFileSync('src/context/DataContext.tsx', code);
  console.log("Updated DataContext.tsx");
}
