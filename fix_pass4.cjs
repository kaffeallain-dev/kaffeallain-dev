const fs = require('fs');
let code = fs.readFileSync('src/views/SettingsView.tsx', 'utf8');

const oldSection = code.substring(code.indexOf('        <section className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-4">'), code.lastIndexOf('</section>') + 10);

const newSection = `        {/* Data & Privacy */}
        <section className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-5">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Data & Privacy</h2>
            <p className="text-sm text-gray-500 mt-1">Export, import, or reset your nutrition history.</p>
          </div>
          
          <div className="space-y-3">
            <button
              onClick={handleExport}
              className="w-full flex flex-col p-4 rounded-2xl border border-gray-200 hover:border-emerald-500 hover:bg-emerald-50 transition-colors text-left group"
            >
              <div className="flex items-center gap-3 mb-1">
                <Download className="w-5 h-5 text-gray-400 group-hover:text-emerald-600" />
                <span className="font-bold text-gray-900 group-hover:text-emerald-700">Export History</span>
              </div>
              <p className="text-sm text-gray-500 ml-8">Download your logged nutrition history as a CSV file.</p>
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex flex-col p-4 rounded-2xl border border-gray-200 hover:border-emerald-500 hover:bg-emerald-50 transition-colors text-left group"
            >
              <div className="flex items-center gap-3 mb-1">
                <Upload className="w-5 h-5 text-gray-400 group-hover:text-emerald-600" />
                <span className="font-bold text-gray-900 group-hover:text-emerald-700">Import History</span>
              </div>
              <p className="text-sm text-gray-500 ml-8">Restore nutrition history from a compatible CSV file.</p>
            </button>
            <input
              type="file"
              accept=".csv"
              ref={fileInputRef}
              onChange={handleImport}
              className="hidden"
            />
          </div>

          <div className="pt-4 border-t border-gray-50">
            {showClearConfirm ? (
              <div className="p-4 rounded-2xl border border-red-200 bg-red-50 space-y-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-bold text-red-900">Clear all data?</p>
                    <p className="text-sm text-red-800 mt-1">
                      This will permanently remove your logged nutrition history from this device.
                    </p>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={() => setShowClearConfirm(false)}
                    className="w-full sm:flex-1 bg-white hover:bg-gray-100 text-gray-800 font-bold py-3 px-4 rounded-xl border border-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleClearData}
                    className="w-full sm:flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded-xl transition-colors shadow-sm"
                  >
                    Clear all data
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowClearConfirm(true)}
                className="w-full flex flex-col p-4 rounded-2xl border border-red-100 hover:border-red-300 hover:bg-red-50 transition-colors text-left group"
              >
                <div className="flex items-center gap-3 mb-1">
                  <Trash2 className="w-5 h-5 text-red-500" />
                  <span className="font-bold text-red-600">Clear All Data</span>
                </div>
                <p className="text-sm text-red-500 ml-8">Remove your logged nutrition history from this device.</p>
              </button>
            )}
          </div>
        </section>`;

if (oldSection) {
  code = code.replace(oldSection, newSection);
  console.log("Replaced successfully!");
}

fs.writeFileSync('src/views/SettingsView.tsx', code);
