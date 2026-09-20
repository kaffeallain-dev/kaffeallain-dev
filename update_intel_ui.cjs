const fs = require('fs');
let code = fs.readFileSync('src/views/LogFoodView.tsx', 'utf8');

const oldUI = `                                    {hasIntel && (
                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                      <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2"><Zap className="w-4 h-4 text-emerald-500" /> Food Intelligence</h3>
                      
                      <div className="grid grid-cols-1 gap-y-4 text-sm">
                        {sections.map(sec => (
                          <div key={sec.id}>
                            <span className={\`text-xs font-semibold uppercase tracking-wider block mb-1 \${sec.color || 'text-gray-500'}\`}>
                              {sec.title}
                            </span>
                            {sec.type === 'tags' ? (
                              <div className="flex flex-wrap gap-1">
                                {(sec.data as string[]).map((item, i) => (
                                  <span key={i} className="px-2 py-0.5 bg-white border rounded-md text-gray-700 text-xs shadow-sm">{item}</span>
                                ))}
                              </div>
                            ) : (
                              <p className="text-gray-700 text-sm leading-relaxed">{sec.data}</p>
                            )}
                          </div>
                        ))}
                        
                        {intel.recommendedFrequency && (
                          <div className="flex justify-between items-center bg-white p-3 rounded-lg border border-gray-100 shadow-sm mt-1">
                            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Frequency</span>
                            <span className={\`text-xs font-bold px-2 py-1 rounded-md \${
                              intel.recommendedFrequency === 'Daily' ? 'bg-emerald-100 text-emerald-700' :
                              intel.recommendedFrequency === 'Occasional' ? 'bg-blue-100 text-blue-700' :
                              'bg-amber-100 text-amber-700'
                            }\`}>{intel.recommendedFrequency}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}`;

const newUI = `                                    {(hasPrimary || hasSecondary) && (
                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                      <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2"><Zap className="w-4 h-4 text-emerald-500" /> Food Intelligence</h3>
                      
                      {hasPrimary && (
                        <div className="grid grid-cols-1 gap-y-4 text-sm mb-2">
                          {primary.map(sec => (
                            <div key={sec.id}>
                              <span className={\`text-xs font-semibold uppercase tracking-wider block mb-1 \${sec.color || 'text-gray-500'}\`}>
                                {sec.title}
                              </span>
                              {sec.type === 'tags' ? (
                                <div className="flex flex-wrap gap-1">
                                  {(sec.data as string[]).map((item, i) => (
                                    <span key={i} className="px-2 py-0.5 bg-white border rounded-md text-gray-700 text-xs shadow-sm">{item}</span>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-gray-700 text-sm leading-relaxed">{sec.data}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {hasSecondary && (
                        <div className="mt-2">
                          <button 
                            onClick={() => setShowMoreIntel(!showMoreIntel)}
                            className="text-xs font-semibold text-gray-500 hover:text-gray-700 flex items-center gap-1 transition-colors w-full text-left py-2"
                          >
                            More about this meal 
                            <svg className={\`w-3 h-3 transition-transform \${showMoreIntel ? 'rotate-180' : ''}\`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                          
                          {showMoreIntel && (
                            <div className="grid grid-cols-1 gap-y-4 text-sm mt-3 pt-3 border-t border-gray-200">
                              {secondary.map(sec => (
                                <div key={sec.id}>
                                  <span className={\`text-xs font-semibold uppercase tracking-wider block mb-1 \${sec.color || 'text-gray-500'}\`}>
                                    {sec.title}
                                  </span>
                                  {sec.type === 'tags' ? (
                                    <div className="flex flex-wrap gap-1">
                                      {(sec.data as string[]).map((item, i) => (
                                        <span key={i} className="px-2 py-0.5 bg-white border rounded-md text-gray-700 text-xs shadow-sm">{item}</span>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="text-gray-700 text-sm leading-relaxed">{sec.data}</p>
                                  )}
                                </div>
                              ))}
                              
                              {intel.recommendedFrequency && (
                                <div className="flex justify-between items-center bg-white p-3 rounded-lg border border-gray-100 shadow-sm">
                                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Frequency</span>
                                  <span className={\`text-xs font-bold px-2 py-1 rounded-md \${
                                    intel.recommendedFrequency === 'Daily' ? 'bg-emerald-100 text-emerald-700' :
                                    intel.recommendedFrequency === 'Occasional' ? 'bg-blue-100 text-blue-700' :
                                    'bg-amber-100 text-amber-700'
                                  }\`}>{intel.recommendedFrequency}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}`;

code = code.replace(oldUI, newUI);
fs.writeFileSync('src/views/LogFoodView.tsx', code);
console.log("Updated Intel UI.");
