const fs = require('fs');
let code = fs.readFileSync('src/views/AnalyticsView.tsx', 'utf8');

const startTag = "{/* Nutrition Gaps & Trends */}";
const endTag = "</div>\\n      )}\\n    </div>\\n  );\\n}";

const startIndex = code.indexOf("{/* Nutrition Gaps & Trends */}");
if (startIndex !== -1) {
   let endIndex = code.lastIndexOf("        </div>\\n      )}\\n    </div>");
   if (endIndex === -1) {
      endIndex = code.lastIndexOf("        </div>\n      )}\n    </div>");
   }

   const newJsx = `{/* YOUR WEEKLY PATTERN */}
        <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 mt-6">
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-4">Your Weekly Pattern</h3>
          
          {weeklyTrends.hasEnoughData ? (
            <div className="space-y-4 mb-8">
              {/* Primary Insight */}
              {weeklyTrends.primary && (
                <div className={\`p-4 rounded-2xl border \${weeklyTrends.primary.colorClass}\`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold">{weeklyTrends.primary.title}</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full bg-white/50 backdrop-blur-sm">
                      {weeklyTrends.primary.status}
                    </span>
                  </div>
                  <p className="text-sm font-medium opacity-90 mb-2">
                    {weeklyTrends.primary.observation}
                  </p>
                  {weeklyTrends.primary.nextStep && (
                    <div className="mt-3 pt-3 border-t border-black/5">
                      <p className="text-xs font-bold opacity-80 uppercase tracking-wider mb-1">Next Step</p>
                      <p className="text-sm opacity-90">{weeklyTrends.primary.nextStep}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Secondary Insights (Compact) */}
              {weeklyTrends.secondary && weeklyTrends.secondary.length > 0 && (
                <div className="grid grid-cols-1 gap-2">
                  {weeklyTrends.secondary.map((trend: any) => (
                    <div key={trend.id} className={\`p-3 rounded-xl border flex items-center justify-between \${trend.colorClass}\`}>
                       <span className="text-sm font-bold">{trend.title}</span>
                       <span className="text-xs font-medium opacity-90">{trend.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-gray-50 rounded-2xl p-6 text-center border border-gray-100 mb-8">
                <Activity className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <h4 className="font-bold text-gray-700 text-sm mb-1">Building your weekly pattern</h4>
                <p className="text-xs text-gray-500">Log a few more meals to make your weekly nutrition pattern clearer.</p>
            </div>
          )}

          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">Your Week At A Glance</h3>
          <p className="text-sm font-medium text-gray-700 mb-4">{chartInterpretation}</p>
          
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyDataArr} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#9ca3af', fontSize: 12, fontWeight: 500 }}
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#9ca3af', fontSize: 12, fontWeight: 500 }}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f9fafb' }} />
                <ReferenceLine y={settings.dailyGoal} stroke="#10b981" strokeDasharray="4 4" label={{ position: 'top', value: 'Goal', fill: '#10b981', fontSize: 10, fontWeight: 600 }} />
                <Bar 
                  dataKey="calories" 
                  fill="#34d399" 
                  radius={[6, 6, 0, 0]}
                  maxBarSize={30}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>`;
   
   if(endIndex !== -1) {
     code = code.substring(0, startIndex) + newJsx + code.substring(endIndex);
     fs.writeFileSync('src/views/AnalyticsView.tsx', code);
     console.log("Patched successfully");
   } else {
     console.log("endIndex not found");
   }
} else {
   console.log("startIndex not found");
}
