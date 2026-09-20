const fs = require('fs');
let code = fs.readFileSync('src/views/AnalyticsView.tsx', 'utf8');

const oldPrimaryJsx = `<div className="flex items-center justify-between mb-2">
                    <span className="font-bold">{weeklyTrends.primary.title}</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full bg-white/50 backdrop-blur-sm">
                      {weeklyTrends.primary.status}
                    </span>
                  </div>`;

const newPrimaryJsx = `<div className="flex items-center justify-between mb-2">
                    <span className="font-bold flex items-center gap-2">
                      {weeklyTrends.primary.status === 'Needs attention' ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                      {weeklyTrends.primary.title}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full bg-white/50 backdrop-blur-sm">
                      {weeklyTrends.primary.status}
                    </span>
                  </div>`;

code = code.replace(oldPrimaryJsx, newPrimaryJsx);

const oldSecondaryJsx = `<span className="text-sm font-bold">{trend.title}</span>`;
const newSecondaryJsx = `<span className="text-sm font-bold flex items-center gap-2">
                          {trend.status === 'Needs attention' ? <AlertTriangle className="w-3.5 h-3.5 opacity-70" /> : 
                           trend.status === 'Looking good' ? <CheckCircle2 className="w-3.5 h-3.5 opacity-70" /> :
                           <Info className="w-3.5 h-3.5 opacity-70" />}
                          {trend.title}
                       </span>`;

code = code.replace(oldSecondaryJsx, newSecondaryJsx);

fs.writeFileSync('src/views/AnalyticsView.tsx', code);
console.log("Patched icons");
