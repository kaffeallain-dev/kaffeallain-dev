const fs = require('fs');
let code = fs.readFileSync('src/views/AnalyticsView.tsx', 'utf8');

const chartEnd = `              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>`;

const chartEndWithLegend = `              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center gap-4 mt-2 justify-center">
            <div className="flex items-center gap-1.5">
               <div className="w-3 h-3 rounded bg-emerald-400"></div>
               <span className="text-xs text-gray-500 font-medium">Logged</span>
            </div>
            <div className="flex items-center gap-1.5">
               <div className="w-3 h-0 border-t-2 border-dashed border-emerald-500"></div>
               <span className="text-xs text-gray-500 font-medium">Target</span>
            </div>
            <div className="flex items-center gap-1.5">
               <div className="w-3 h-3 rounded bg-transparent border border-gray-200"></div>
               <span className="text-xs text-gray-500 font-medium">No data</span>
            </div>
          </div>
        </div>`;

if (code.includes(chartEnd)) {
    code = code.replace(chartEnd, chartEndWithLegend);
    fs.writeFileSync('src/views/AnalyticsView.tsx', code);
    console.log("Patched chart legend");
} else {
    console.log("Could not find chart end");
}
