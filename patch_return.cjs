const fs = require('fs');
let code = fs.readFileSync('src/views/AnalyticsView.tsx', 'utf8');

const oldReturn = `    return { 
      todayLogs, 
      weeklyDataArr, 
      currentSummary, 
      previousSummary, 
      recentLog,
      isMeaningfulChange, 
      lastLog,
      caloriesConsumed,
      remaining,
      daysWithData
    };
  }, [allConsumptions, settings]);`;

const newReturn = `    return { 
      todayLogs, 
      weeklyLogs,
      weeklyDataArr, 
      currentSummary, 
      previousSummary, 
      recentLog,
      isMeaningfulChange, 
      lastLog,
      caloriesConsumed,
      remaining,
      daysWithData
    };
  }, [allConsumptions, settings]);`;

code = code.replace(oldReturn, newReturn);

const oldDestructure = `  const { 
    todayLogs, 
    weeklyDataArr, 
    currentSummary, 
    previousSummary, 
    recentLog,
    isMeaningfulChange,
    lastLog,
    caloriesConsumed,
    remaining,
    daysWithData
  } = useMemo(() => {`;

const newDestructure = `  const { 
    todayLogs,
    weeklyLogs,
    weeklyDataArr, 
    currentSummary, 
    previousSummary, 
    recentLog,
    isMeaningfulChange,
    lastLog,
    caloriesConsumed,
    remaining,
    daysWithData
  } = useMemo(() => {`;

code = code.replace(oldDestructure, newDestructure);

fs.writeFileSync('src/views/AnalyticsView.tsx', code);
console.log("Patched return and destructure.");
